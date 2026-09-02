"""管理后台 API 与页面（统一 check_admin 门禁；令牌错误全局限速防暴破）。"""
import json
import os
import re

import httpx
from fastapi import APIRouter, Header, HTTPException
from fastapi.responses import Response

from . import db, llm, ops_status, similarity, taxonomy
from .deps import ACCESS_CODE, IMPORT_TOKEN, check_admin

router = APIRouter()


@router.get("/api/admin/stats")
def api_admin_stats(response: Response, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    data, state = db.admin_stats_state()
    response.headers["X-Kg-Cache"] = state
    return data


@router.get("/api/admin/llm_health")
async def api_admin_llm_health(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    out = []
    seen = set()
    for name, base in (("视觉/主通道", llm.BASE_URL), ("文字通道", llm.TEXT_BASE_URL), ("备用通道", llm.RESCUE_BASE_URL)):
        if not base or base in seen:
            continue
        seen.add(base)
        host = base.split("//")[-1].split("/")[0]
        masked = host[:6] + "…" + host[-10:] if len(host) > 20 else host
        try:
            async with httpx.AsyncClient(timeout=httpx.Timeout(10.0, connect=8.0)) as client:
                r = await client.get(f"{base}/v1/models")
            ok = r.status_code < 500
            out.append({"name": name, "host": masked, "ok": ok, "status": r.status_code})
        except Exception:
            out.append({"name": name, "host": masked, "ok": False, "status": "不可达"})
    return {"items": out}


@router.get("/api/admin/questions")
def api_admin_questions(
    keyword: str | None = None,
    module: str | None = None,
    flagged: int = 0,
    disabled: int = 0,
    offset: int = 0,
    limit: int = 20,
    qid: int | None = None,
    min_score: int | None = None,
    max_score: int | None = None,
    sort: str | None = None,
    x_admin_token: str | None = Header(None),
):
    check_admin(x_admin_token)
    return {
        "items": db.admin_search_questions(
            keyword, module, flagged=bool(flagged), disabled_only=bool(disabled), offset=offset, limit=limit, qid=qid,
            min_score=min_score, max_score=max_score, sort=sort,
        )
    }


@router.patch("/api/admin/questions/{qid}")
def api_admin_update_question(qid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    if "tag3" in body:
        code = (body["tag3"] or "").strip()
        if code and code != "UNKNOWN" and code not in taxonomy.topic_index():
            raise HTTPException(400, "未知考点 code")
        body["tag3"] = code or None
    if "options" in body:
        if not isinstance(body["options"], dict):
            raise HTTPException(400, "options 需为对象")
        body["options"] = json.dumps(body["options"], ensure_ascii=False)
    if not db.admin_update_question(qid, body):
        raise HTTPException(400, "无可更新字段或题目不存在")
    if "tag3" in body:
        db.tag3_review_close(qid)
    return {"ok": True}

@router.get("/api/admin/taxonomy/questions")
def api_admin_taxonomy_questions(code: str, offset: int = 0, limit: int = 20, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.questions_by_tag3(code, offset=offset, limit=limit)}


@router.get("/api/admin/tag3_review")
def api_admin_tag3_review(limit: int = 100, module: str | None = None, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.tag3_review_list(limit, module)


@router.get("/api/admin/similar_questions")
def api_admin_similar_questions(qid: int, limit: int = 10, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    conn = db.get_conn()
    try:
        items = similarity.find_similar(conn, qid, limit=min(limit, 50))
    finally:
        conn.close()
    return {"qid": qid, "items": items}


@router.get("/api/admin/dup_clusters")
def api_admin_dup_clusters(offset: int = 0, limit: int = 20, status: str = "open", x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {**db.dup_cluster_list(offset=offset, limit=limit, status=status), "stats": db.dup_cluster_stats()}


@router.get("/api/admin/dup_clusters/{cluster_id}")
def api_admin_dup_cluster_detail(cluster_id: int, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"cluster_id": cluster_id, "items": db.dup_cluster_detail(cluster_id)}


@router.post("/api/admin/dup_clusters/{cluster_id}/resolve")
def api_admin_dup_cluster_resolve(cluster_id: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    keep = body.get("keep_qid")
    res = db.dup_cluster_resolve(cluster_id, int(keep) if keep is not None else None)
    if not res.get("ok"):
        raise HTTPException(400, res.get("error", "处理失败"))
    return res


@router.get("/api/admin/flagged_cache")
def api_admin_flagged_cache(limit: int = 30, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_flagged_cache(limit)}


@router.delete("/api/admin/cache/{key}")
def api_admin_delete_cache(key: str, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"ok": db.admin_delete_cache(key)}

ADMIN_DIR = os.path.join(os.path.dirname(__file__), "admin")


def admin_assets_version() -> str:
    latest = 0.0
    for root, _dirs, files in os.walk(ADMIN_DIR):
        for f in files:
            if f.endswith((".js", ".css")):
                latest = max(latest, os.path.getmtime(os.path.join(root, f)))
    return str(int(latest))


@router.api_route("/admin", methods=["GET", "HEAD"])
def admin_page():
    with open(os.path.join(ADMIN_DIR, "index.html"), encoding="utf-8") as f:
        html = f.read()
    html = re.sub(r"\?v=[A-Za-z0-9._-]+", "?v=" + admin_assets_version(), html)
    return Response(html, media_type="text/html", headers={"Cache-Control": "no-cache"})

@router.get("/api/admin/dashboard")
def api_admin_dashboard(response: Response, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    data, state = db.admin_dashboard_state()
    response.headers["X-Kg-Cache"] = state
    return data


@router.get("/api/admin/ops_status")
def api_admin_ops_status(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return ops_status.parse_ops_status(os.environ.get("OPS_REPORTS_DIR", "/reports"))


@router.get("/api/admin/governance")
def api_admin_governance(response: Response, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    data, state = db.governance_scan_state()
    response.headers["X-Kg-Cache"] = state
    return data


@router.get("/api/admin/users")
def api_admin_users(
    keyword: str | None = None,
    offset: int = 0,
    limit: int = 20,
    inactive_days: int | None = None,
    x_admin_token: str | None = Header(None),
):
    check_admin(x_admin_token)
    return db.admin_users(keyword, offset, limit, inactive_days)


@router.get("/api/admin/users/{uid}")
def api_admin_user_detail(uid: str, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    d = db.admin_user_detail(uid.strip()[:64])
    if not d:
        raise HTTPException(404, "用户不存在")
    return d


@router.get("/api/admin/shizheng")
def api_admin_shizheng(offset: int = 0, limit: int = 20, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.admin_shizheng(offset, limit)


@router.get("/api/admin/shenlun_overview")
def api_admin_shenlun_overview(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return db.admin_shenlun_overview()


@router.post("/api/admin/tag3_review/reopen")
def api_admin_tag3_review_reopen(body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    qid = int(body.get("question_id") or 0)
    if not qid:
        raise HTTPException(400, "缺少 question_id")
    return {"ok": db.tag3_review_reopen(qid)}


@router.get("/api/admin/settings_info")
def api_admin_settings_info(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    tok = IMPORT_TOKEN or ""
    return {
        "import_token": ({"set": True, "masked": tok[:2] + "··" + tok[-4:]} if len(tok) >= 8
                         else {"set": bool(tok), "masked": "··"}),
        "llm_model": os.environ.get("LLM_MODEL", ""),
        "access_code_enabled": bool(ACCESS_CODE),
    }

@router.get("/api/admin/question_reports")
def api_admin_question_reports(status: str = "open", x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    st = status if status in ("open", "fixed", "rejected") else "open"
    return {"items": db.admin_list_reports(st), "open_count": db.admin_open_report_count()}


@router.patch("/api/admin/question_reports/{rid}")
def api_admin_patch_question_report(rid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    status = body.get("status")
    if status not in ("open", "fixed", "rejected"):
        raise HTTPException(400, "status 需为 open/fixed/rejected")
    note = body.get("note")
    if not db.admin_handle_report(rid, status, str(note)[:500] if note else None):
        raise HTTPException(404, "纠错记录不存在")
    return {"ok": True}

@router.get("/api/admin/exam_papers")
def api_admin_exam_papers(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.list_exam_papers()}

@router.post("/api/admin/refresh_stats")
def api_admin_refresh_stats(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"updated": db.refresh_question_stats()}


@router.get("/api/admin/reports")
def api_admin_reports(status: str = "open", x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_list_reports(status if status in ("open", "resolved", "dismissed") else "open")}


@router.post("/api/admin/reports/{rid}/resolve")
def api_admin_resolve_report(rid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    status = body.get("status")
    if status not in ("resolved", "dismissed"):
        raise HTTPException(400, "status 需为 resolved 或 dismissed")
    return {"ok": db.admin_resolve_report(rid, status)}


@router.get("/api/admin/batches")
def api_admin_batches(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_batches_v3()}


@router.get("/api/admin/batches/{bid}/sample")
def api_admin_batch_sample(bid: str, limit: int = 10, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_batch_sample(bid, min(limit, 50)), "reviews": db.sample_reviews(bid)}


@router.post("/api/admin/batches/{bid}/sample_reviews")
def api_admin_batch_sample_review(bid: str, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    qid = int(body.get("question_id") or 0)
    verdict = body.get("verdict")
    if not qid:
        raise HTTPException(400, "缺少 question_id")
    if verdict is None:
        db.sample_review_delete(bid, qid)
        return {"ok": True, "summary": db.sample_review_summary(bid)}
    if verdict not in ("ok", "problem"):
        raise HTTPException(400, "verdict 需为 ok/problem")
    note = str(body.get("note") or "")[:300] or None
    return {"ok": True, "summary": db.sample_review_set(bid, qid, verdict, note)}


@router.post("/api/admin/batches/{bid}/decide")
def api_admin_batch_decide(bid: str, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"n": db.admin_batch_decide(bid, bool(body.get("approve")))}

@router.get("/api/admin/announcements")
def api_admin_announcements(x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    return {"items": db.admin_list_announcements()}


@router.post("/api/admin/announcements")
def api_admin_create_announcement(body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    title = (body.get("title") or "").strip()
    if not title:
        raise HTTPException(400, "标题不能为空")
    return {"id": db.admin_create_announcement(title, (body.get("body") or "").strip())}


@router.patch("/api/admin/announcements/{aid}")
def api_admin_toggle_announcement(aid: int, body: dict, x_admin_token: str | None = Header(None)):
    check_admin(x_admin_token)
    if not db.admin_set_announcement(aid, bool(body.get("active"))):
        raise HTTPException(404, "公告不存在")
    return {"ok": True}

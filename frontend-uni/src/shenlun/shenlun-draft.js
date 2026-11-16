// 申论作答草稿服务端同步决策（纯函数）：本机非空一律本机优先，绝不覆盖正在写的内容。
export function adoptServerDraft(localContent, server) {
  const local = typeof localContent === 'string' ? localContent : '';
  if (local) return null;
  const remote = server && typeof server.content === 'string' ? server.content : '';
  return remote || null;
}

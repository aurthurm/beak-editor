import { documentHashOfServer, getServerDocument } from '../../utils/v2Store';

/** Read the authoritative controlled document (blocks, lifecycles, audit, security log). */
export default defineEventHandler(async (event) => {
  const query = getQuery(event);
  const id = typeof query.id === 'string' && query.id ? query.id : 'controlled-sop';
  const doc = getServerDocument(id);
  if (!doc) return { exists: false, id };
  return { exists: true, ...doc, documentHash: await documentHashOfServer(doc) };
});

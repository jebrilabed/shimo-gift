import { adminMessages as messages } from "@/lib/admin/messages";

export default function AdminLoading() {
  return <div className="admin-page admin-loading" role="status"><span>{messages.ar.loading}</span><span className="ui-skeleton" /><span className="ui-skeleton" /><span className="ui-skeleton" /></div>;
}

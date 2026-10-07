import { Container } from "@/components/ui";

export default function StoreLoading() {
  return <main className="store-main"><Container><div aria-label="جاري التحميل" className="ui-loading" role="status"><span className="ui-skeleton" /><span className="ui-skeleton" /><span className="ui-skeleton" /></div></Container></main>;
}

import { redirect } from 'next/navigation';

/** 旧入口保留兼容，但不再展示独立的内容样本目录。 */
export default function DemoContentRedirect() {
  redirect('/demo/profile');
}

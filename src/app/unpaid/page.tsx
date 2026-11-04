import { redirect } from 'next/navigation';

export default function UnpaidRedirectPage() {
  redirect('/admin?menu=unpaid');
}

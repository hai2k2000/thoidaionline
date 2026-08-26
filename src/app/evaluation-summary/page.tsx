import { redirect } from 'next/navigation'; import { getSessionUser } from '@/lib/serverSession'; import PublicEvaluationSummary from '@/components/PublicEvaluationSummary';
export default async function Page(){if(!(await getSessionUser()))redirect('/login'); return <PublicEvaluationSummary/>;}

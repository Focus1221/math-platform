import { Suspense } from 'react';
import { connection } from 'next/server';
import { createServerSupabase } from '@/lib/supabase/server';
import SimulatorsLabClient from '@/components/simulators/SimulatorsLabClient';
import type { Profile } from '@/types/db';

async function SimulatorsContent({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  await connection();
  const { sim } = await searchParams;
  const supabase = await createServerSupabase();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  let profile: Profile | null = null;
  let initialSolved = 0;

  if (user) {
    const [{ data: prof }, { data: progRows }] = await Promise.all([
      supabase.from('profiles').select('*').eq('id', user.id).single(),
      supabase
        .from('topic_progress')
        .select('sim_correct_count')
        .eq('student_id', user.id),
    ]);

    profile = prof as Profile | null;
    for (const row of progRows || []) {
      initialSolved += Number(row.sim_correct_count || 0);
    }
  }

  return (
    <SimulatorsLabClient
      profile={profile}
      initialSim={sim}
      initialSolved={initialSolved}
    />
  );
}

export default function SimulatorsPage({
  searchParams,
}: {
  searchParams: Promise<{ sim?: string }>;
}) {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center text-sm font-semibold text-slate-500">
          Загрузка тренажёров...
        </div>
      }
    >
      <SimulatorsContent searchParams={searchParams} />
    </Suspense>
  );
}
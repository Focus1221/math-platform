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
  if (user) {
    const { data } = await supabase
      .from('profiles')
      .select('*')
      .eq('id', user.id)
      .single();
    profile = data as Profile | null;
  }

  return <SimulatorsLabClient profile={profile} initialSim={sim} />;
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
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { loadEnvFiles } from '@/lib/load-env';
import { handleProgressGet } from '@/lib/progress-handler';

export async function GET() {
    loadEnvFiles();

    return handleProgressGet({
        createSupabaseClient: async () => {
            const cookieStore = await cookies();
            return createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                { cookies: { getAll: () => cookieStore.getAll() } },
            );
        },
    });
}
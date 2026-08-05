window.sb = supabase.createClient(
  'https://yaiewmzgdldncnwtgnap.supabase.co',
  'sb_publishable_A9QkGJVCPhBy_9guUCNhbg_6X8itN7s',
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);

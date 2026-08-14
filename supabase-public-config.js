// Public browser configuration for the deployed dashboard.
// This publishable key is protected by Supabase Auth and RLS; never add a service-role key here.
window.SUPABASE_CONFIG = {
  url: 'https://emkekdsdimzwcxcaweuj.supabase.co',
  anonKey: 'sb_publishable_u6SckD_gRv1QY5t5SizfNA_6IA7n8Px',
};

// Load the PPTX mobile/tablet compatibility patch after the main app script.
window.addEventListener('load', () => {
  const script = document.createElement('script');
  script.src = 'pptx-download-fix.js?v=1';
  document.body.appendChild(script);
});

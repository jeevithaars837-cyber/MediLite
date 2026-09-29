import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'placeholder-service-role-key';

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
  },
});

async function main() {
  console.log('=== CareSync Demo Seeding Script ===');
  console.log('Target Supabase URL:', supabaseUrl);

  const doctorEmail = 'doctor@demo.caresync';
  const doctorPassword = 'Password123!';
  const patient1Email = 'patient1@demo.caresync';
  const patient1Password = 'Password123!';
  const patient2Email = 'patient2@demo.caresync';
  const patient2Password = 'Password123!';

  // 1. Create or get doctor user
  console.log('Creating demo doctor account...');
  let { data: doctorUser, error: docErr } = await supabase.auth.admin.createUser({
    email: doctorEmail,
    password: doctorPassword,
    email_confirm: true,
    user_metadata: { full_name: 'Dr. Sarah Connor' },
  });

  if (docErr && docErr.message.includes('already registered')) {
    console.log('Doctor already exists, fetching user...');
    const { data: users } = await supabase.auth.admin.listUsers();
    doctorUser = { user: users.users.find((u) => u.email === doctorEmail) as any };
  }

  if (doctorUser?.user) {
    // Elevate role to 'doctor' in profiles table
    await supabase.from('profiles').update({ role: 'doctor', full_name: 'Dr. Sarah Connor' }).eq('id', doctorUser.user.id);
  }

  // 2. Create demo patients
  console.log('Creating demo patient accounts...');
  let { data: p1User } = await supabase.auth.admin.createUser({
    email: patient1Email,
    password: patient1Password,
    email_confirm: true,
    user_metadata: { full_name: 'Alex Rivera' },
  });

  let { data: p2User } = await supabase.auth.admin.createUser({
    email: patient2Email,
    password: patient2Password,
    email_confirm: true,
    user_metadata: { full_name: 'Jordan Lee' },
  });

  console.log('\n=== SEED COMPLETE ===');
  console.log('Doctor Credentials:   Email:', doctorEmail, '  Password:', doctorPassword);
  console.log('Patient 1 Credentials: Email:', patient1Email, ' Password:', patient1Password);
  console.log('Patient 2 Credentials: Email:', patient2Email, ' Password:', patient2Password);
}

main().catch(console.error);

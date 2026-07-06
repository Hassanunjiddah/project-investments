import { handleCors } from '../_shared/cors.ts';
import { createUserClient, createServiceClient, requireUser } from '../_shared/supabaseClient.ts';
import { assertRole, getUserRole } from '../_shared/auth.ts';
import { errorResponse, HttpError, jsonResponse } from '../_shared/errors.ts';

const PASSWORD_WORDS = ['river', 'trade', 'share', 'green', 'market', 'ledger', 'profit', 'sun'];

function generateSimplePassword(): string {
  const word = PASSWORD_WORDS[Math.floor(Math.random() * PASSWORD_WORDS.length)];
  const digits = 1000 + Math.floor(Math.random() * 9000);
  return `${word}${digits}`;
}

function isValidEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

Deno.serve(async (req) => {
  const cors = handleCors(req);
  if (cors) return cors;

  try {
    const supabase = createUserClient(req);
    const user = await requireUser(supabase);
    const role = await getUserRole(supabase, user.id);
    assertRole(role, ['ADMIN'], 'Only admins can create users');

    const body = await req.json();
    const email = String(body.email ?? '').trim().toLowerCase();
    const fullName = String(body.fullName ?? '').trim();
    const newRole = body.role;

    if (!email || !isValidEmail(email)) {
      throw new HttpError(400, 'Valid email is required');
    }
    if (fullName.length < 2) {
      throw new HttpError(400, 'Full name must be at least 2 characters');
    }
    if (newRole !== 'LINE_MANAGER' && newRole !== 'INVESTOR') {
      throw new HttpError(400, 'Role must be LINE_MANAGER or INVESTOR');
    }

    const password = generateSimplePassword();
    const admin = createServiceClient();

    const { data, error } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { full_name: fullName, role: newRole },
    });

    if (error) {
      const message = error.message.includes('already')
        ? 'A user with this email already exists'
        : error.message;
      throw new HttpError(400, message);
    }

    if (!data.user) {
      throw new HttpError(500, 'User creation failed');
    }

    return jsonResponse({
      userId: data.user.id,
      email,
      fullName,
      role: newRole,
      password,
    });
  } catch (error) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return jsonResponse({ error: 'Unauthorized' }, 401);
    }
    return errorResponse(error);
  }
});

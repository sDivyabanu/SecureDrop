import { NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/prisma/db';
import { hashPassword } from '@/lib/auth/password';
import { parseJsonBody } from '@/lib/http/json-body';

const registerSchema = z
  .object({
    name: z.string().trim().min(1, 'Name is required').max(100),
    email: z.string().trim().toLowerCase().email('Enter a valid email address').max(255),
    password: z
      .string()
      .min(10, 'Password must be at least 10 characters')
      .max(200)
      .regex(/[A-Za-z]/, 'Password must contain a letter')
      .regex(/[0-9]/, 'Password must contain a number'),
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: 'Passwords do not match',
    path: ['confirmPassword'],
  });

export async function POST(req: Request) {
  const parsedBody = await parseJsonBody(req);
  if (!parsedBody.ok) {
    return NextResponse.json({ error: parsedBody.error }, { status: parsedBody.status });
  }

  const parsed = registerSchema.safeParse(parsedBody.body);
  if (!parsed.success) {
    const firstIssue = parsed.error.issues[0];
    return NextResponse.json({ error: firstIssue?.message ?? 'Invalid registration data' }, { status: 400 });
  }

  const { name, email, password } = parsed.data;

  const existing = await db.orm.public.User.where((u) => u.email.eq(email)).first();
  if (existing) {
    return NextResponse.json({ error: 'An account with this email already exists' }, { status: 409 });
  }

  const passwordHash = await hashPassword(password);

  try {
    await db.orm.public.User.select('id').create({ name, email, passwordHash });
  } catch {
    return NextResponse.json({ error: 'Registration failed. Please try again.' }, { status: 500 });
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

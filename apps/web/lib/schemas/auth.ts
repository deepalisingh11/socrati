import { z } from 'zod';
import { isAllowedDomain } from '@/lib/supabase/domains';

export const signupSchema = z.object({
    name: z.string().min(2, 'Name must be at least 2 characters'),
    email: z
        .string()
        .email('Enter a valid email address')
        .refine(isAllowedDomain, 'Must be a UMass or Five College email (@umass.edu, @smith.edu, @hampshire.edu, @mtholyoke.edu, @amherst.edu)'),
    password: z
        .string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Must contain at least one uppercase letter')
        .regex(/[0-9]/, 'Must contain at least one number'),
});

export const loginSchema = z.object({
    email: z.string().email('Enter a valid email address'),
    password: z.string().min(1, 'Password is required'),
});

export type SignupFormData = z.infer<typeof signupSchema>;
export type LoginFormData = z.infer<typeof loginSchema>;

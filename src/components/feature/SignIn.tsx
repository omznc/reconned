"use client"
import { authClient } from "@/lib/auth-client"; //import the auth client
import { useState } from 'react';
import Link from "next/link";
import {useRouter} from "next/navigation";

export default function SignIn() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');

    const {push} = useRouter();

    const handleSignIn = async () => {
        await authClient.signIn.email({
            email: email,
            password: password
        }, {
            onRequest: () => {
                //show loading
            },
            onSuccess: () => {
                push('/');
            },
            onError: (ctx) => {
                alert(ctx.error.message)
            }
        })
    }

    return (
        <div>
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Link href="/signup">Sign Up</Link>
            <button onClick={handleSignIn}>Sign In</button>
        </div>
    );
}
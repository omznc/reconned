"use client"

import { authClient } from "@/lib/auth-client"; //import the auth client
import React, { useState } from 'react';
import Link from "next/link";
import {useRouter} from "next/navigation";

export default function SignUp() {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [name, setName] = useState('');

    const {push} = useRouter();

    const signUp = async () => {
        const { data, error } = await authClient.signUp.email({
            email,
            password,
            name,
        }, {
            onRequest: (ctx) => {
                //show loading
            },
            onSuccess: (ctx) => {
                push('/login');
            },
            onError: (ctx) => {
                alert(ctx.error.message);
            },
        });
    };

    return (
        <div>
            <input type="name" value={name} onChange={(e) => setName(e.target.value)} />
            <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
            <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            <Link href="/login">Sign In</Link>
            <button onClick={signUp}>Sign Up</button>
        </div>
    );
}
"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import axios from "axios"
import { useRouter } from "next/navigation"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"

export default function LoginPage() {
    const router = useRouter()
    const [step, setStep] = useState<"credentials" | "2fa">("credentials")
    const [error, setError] = useState<string | null>(null)

    const { register, handleSubmit, getValues } = useForm()

    const onSubmit = async (data: any) => {
        setError(null)
        try {
            const payload = {
                username: data.email,
                password: data.password,
                totp_code: data.totp_code || undefined
            }

            // TODO: Replace with env var
            const API_URL = "http://localhost:8000/api/v1"

            const response = await axios.post(`${API_URL}/login/access-token`, payload)

            console.log("Login success:", response.data)
            // Save token (in real app, use HTTP-only cookie or secure storage)
            localStorage.setItem("token", response.data.access_token)
            router.push("/")

        } catch (err: any) {
            if (err.response?.status === 401 && err.response?.data?.detail === "2FA_REQUIRED") {
                setStep("2fa")
            } else {
                setError(err.response?.data?.detail || "Login failed")
            }
        }
    }

    return (
        <div className="flex h-screen w-full items-center justify-center bg-zinc-950 text-zinc-50">
            <Card className="w-[350px] border-zinc-800 bg-zinc-900 text-zinc-50">
                <CardHeader>
                    <CardTitle>DeepSave Pro</CardTitle>
                    <CardDescription className="text-zinc-400">
                        {step === "credentials" ? "Enter your credentials" : "Enter 2FA Code"}
                    </CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleSubmit(onSubmit)}>
                        <div className="grid w-full items-center gap-4">
                            {step === "credentials" && (
                                <>
                                    <div className="flex flex-col space-y-1.5">
                                        <Label htmlFor="email">Email</Label>
                                        <Input id="email" placeholder="admin@example.com" {...register("email")} className="bg-zinc-950 border-zinc-800 text-white" />
                                    </div>
                                    <div className="flex flex-col space-y-1.5">
                                        <Label htmlFor="password">Password</Label>
                                        <Input id="password" type="password" {...register("password")} className="bg-zinc-950 border-zinc-800 text-white" />
                                    </div>
                                </>
                            )}

                            {step === "2fa" && (
                                <div className="flex flex-col space-y-1.5">
                                    <Label htmlFor="totp_code">Authenticator Code</Label>
                                    <Input id="totp_code" placeholder="123456" {...register("totp_code")} className="bg-zinc-950 border-zinc-800 text-white" autoFocus />
                                </div>
                            )}

                            {error && <p className="text-sm text-red-500">{error}</p>}
                        </div>

                        <Button className="w-full mt-6" type="submit">
                            {step === "credentials" ? "Login" : "Verify"}
                        </Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    )
}

"use client"
import Link from 'next/link'
import { Home, Search, Archive, Settings, LogOut } from 'lucide-react'
import { Button } from "@/components/ui/button"

export default function Layout({ children }: { children: React.ReactNode }) {
    return (
        <div className="flex h-screen bg-zinc-950 text-white">
            {/* Sidebar */}
            <aside className="w-64 border-r border-zinc-800 p-4 flex flex-col">
                <h1 className="text-xl font-bold mb-8 px-2">DeepSave Pro</h1>

                <nav className="flex-1 space-y-2">
                    <Link href="/">
                        <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900">
                            <Home className="mr-2 h-4 w-4" /> Home
                        </Button>
                    </Link>
                    <Link href="/search">
                        <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900">
                            <Search className="mr-2 h-4 w-4" /> Search
                        </Button>
                    </Link>
                    <Link href="/archive">
                        <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900">
                            <Archive className="mr-2 h-4 w-4" /> Archive
                        </Button>
                    </Link>
                </nav>

                <div className="pt-4 border-t border-zinc-800">
                    <Link href="/settings">
                        <Button variant="ghost" className="w-full justify-start text-zinc-400 hover:text-white hover:bg-zinc-900">
                            <Settings className="mr-2 h-4 w-4" /> Settings
                        </Button>
                    </Link>
                    <Button variant="ghost" className="w-full justify-start text-red-500 hover:text-red-400 hover:bg-zinc-900 mt-2">
                        <LogOut className="mr-2 h-4 w-4" /> Logout
                    </Button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 overflow-auto">
                {children}
            </main>
        </div>
    )
}

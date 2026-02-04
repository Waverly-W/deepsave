"use client"
import { useEffect, useState } from 'react'
import api from '@/lib/api'
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { FileText, Image, Code, ShoppingCart, Loader2 } from 'lucide-react'

// Types
interface Item {
  id: string;
  title: string;
  url: string;
  summary: string;
  source_type: string;
  processing_status: string;
  tags: string[];
}

const SourceIcon = ({ type }: { type: string }) => {
  switch (type) {
    case 'code': return <Code className="w-4 h-4 text-blue-400" />;
    case 'image': return <Image className="w-4 h-4 text-purple-400" />;
    case 'product': return <ShoppingCart className="w-4 h-4 text-green-400" />;
    default: return <FileText className="w-4 h-4 text-zinc-400" />;
  }
}

export default function Dashboard() {
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchItems = async () => {
      try {
        const res = await api.get('/items/');
        setItems(res.data);
      } catch (err) {
        console.error(err);
        // Redirect to login if 401
        if (window.location.pathname !== '/login') {
          // VERY simplistic auth guard
        }
      } finally {
        setLoading(false);
      }
    }
    fetchItems();
  }, []);

  if (loading) {
    return <div className="flex items-center justify-center h-full"><Loader2 className="animate-spin" /></div>
  }

  return (
    <div className="p-8">
      <header className="flex justify-between items-center mb-8">
        <h2 className="text-3xl font-bold">My Knowledge</h2>
        <div className="text-zinc-500">
          {items.length} items
        </div>
      </header>

      {/* Grid Gallery */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {items.map((item) => (
          <Card key={item.id} className="bg-zinc-900 border-zinc-800 hover:border-zinc-700 transition-colors">
            <CardHeader className="pb-2">
              <div className="flex justify-between items-start">
                <SourceIcon type={item.source_type} />
                <span className={`text-xs px-2 py-0.5 rounded-full ${item.processing_status === 'completed' ? 'bg-green-900 text-green-300' : 'bg-yellow-900 text-yellow-300'
                  }`}>
                  {item.processing_status}
                </span>
              </div>
              <CardTitle className="text-lg mt-2 line-clamp-2">
                <a href={item.url} target="_blank" className="hover:underline">
                  {item.title || item.url}
                </a>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-zinc-400 line-clamp-3">
                {item.summary || "No summary generated yet. Processing..."}
              </p>
            </CardContent>
            <CardFooter className="pt-0 flex gap-2 overflow-hidden">
              {/* Tags placeholder */}
              <Badge variant="outline" className="text-zinc-500 border-zinc-700">#example</Badge>
            </CardFooter>
          </Card>
        ))}
      </div>

      {items.length === 0 && (
        <div className="text-center text-zinc-500 mt-20">
          <p>No items found. Use the Chrome Extension to save content.</p>
        </div>
      )}
    </div>
  )
}

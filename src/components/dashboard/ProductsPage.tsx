import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { 
  Sparkles,
  Music,
  Headphones,
  MessageSquare,
  Wand2
} from "lucide-react"

const productItems = [
  { id: "studio", label: "Studio", icon: Sparkles },
  { id: "music", label: "Music", icon: Music },
  { id: "dubbing", label: "Dubbing", icon: Headphones },
  { id: "speech-to-text", label: "Speech to Text", icon: MessageSquare },
  { id: "productions", label: "Productions", icon: Wand2 },
]

export function ProductsPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-600">Explore our suite of voice AI products</p>
      </div>
      
      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
        {productItems.map((item) => (
          <Card key={item.id} className="bg-white border-gray-200 hover:shadow-md transition-shadow cursor-pointer">
            <CardContent className="p-6">
              <div className="flex items-center space-x-4 mb-4">
                <div className="w-12 h-12 bg-blue-600 rounded-full flex items-center justify-center">
                  <item.icon className="h-6 w-6 text-white" />
                </div>
                <h3 className="text-gray-900 font-medium">{item.label}</h3>
              </div>
              <p className="text-gray-600 text-sm mb-4">Advanced {item.label.toLowerCase()} capabilities powered by AI</p>
              <Button variant="outline" className="w-full border-gray-300 text-gray-700 hover:bg-gray-50">
                Learn More
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  )
}

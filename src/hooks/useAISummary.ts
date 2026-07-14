import { useState, useEffect } from 'react'
import { supabase } from '../lib/supabase'

export function useAISummary() {
  const [summary, setSummary] = useState('')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  const generate = async (dashData?: any) => {
    setLoading(true)
    setError('')
    try {
      const yesterday = new Date()
      yesterday.setDate(yesterday.getDate() - 1)
      const d = yesterday.toISOString().split('T')[0]

      const { data: sales } = await supabase
        .from('sales')
        .select('net_amount, payment_mode')
        .gte('created_at', d + 'T00:00:00')
        .lte('created_at', d + 'T23:59:59')

      const { data: lowStock } = await supabase
        .from('products')
        .select('name, stock_qty')
        .filter('stock_qty', 'lte', 5)
        .eq('is_active', true)
        .limit(3)

      const total = sales?.reduce(
        (s, x) => s + Number(x.net_amount), 0
      ) || 0
      const orders = sales?.length || 0
      const avgOrder = orders > 0
        ? (total / orders).toFixed(0) : 0

      const context = `
        Date: ${d}
        Total revenue: ₹${total.toFixed(0)}
        Total orders: ${orders}
        Average order value: ₹${avgOrder}
        Payment breakdown: ${JSON.stringify(
          sales?.reduce((acc: any, s) => {
            acc[s.payment_mode] = 
              (acc[s.payment_mode] || 0) + 1
            return acc
          }, {})
        )}
        Low stock products: ${
          lowStock?.map(p =>
            p.name + ' (' + p.stock_qty + ' left)'
          ).join(', ') || 'none'
        }
      `

      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${import.meta.env.VITE_GEMINI_API_KEY}`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: `You are a friendly business advisor
                for a small Indian retail shop.
                Write a 2-3 sentence summary of
                yesterday's performance in simple English.
                Be specific with numbers.
                Use ₹ for currency.
                Mention any low stock warnings at the end.
                Write as ONE paragraph, no bullet points.
                Sound warm and helpful, not robotic.
                
                Business data: ${context}`
              }]
            }],
            generationConfig: {
              maxOutputTokens: 150,
              temperature: 0.7
            }
          })
        }
      )

      const json = await res.json()
      const text =
        json.candidates?.[0]
          ?.content?.parts?.[0]?.text
        || 'Your business is making steady progress. Check your sales report for detailed insights.'

      setSummary(text.trim())
    } catch (e) {
      setSummary(
        'Great work yesterday! Your shop ' +
        'continues to serve customers well. ' +
        'Check the reports section for details.'
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => { generate() }, [])
  return { summary, loading, error, refresh: generate }
}

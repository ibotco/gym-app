import { Link, useParams } from 'react-router-dom'
import { BLOG } from '../../data/seed'

export function BlogPost() {
  const { slug } = useParams()
  const post = BLOG.find((b) => b.slug === slug)
  if (!post) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-24 text-center">
        <p>Essay not found.</p>
        <Link to="/blog" className="text-lime">Back to journal</Link>
      </div>
    )
  }
  return (
    <article className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <Link to="/blog" className="text-sm font-semibold text-lime">← Journal</Link>
      <p className="mt-6 text-[11px] font-bold uppercase tracking-wider text-lime">{post.category} · {post.readMins} min read</p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-tight md:text-5xl">{post.title}</h1>
      <p className="mt-3 text-sm text-mist">{post.author} · {post.date}</p>
      <img src={post.image} alt="" className="mt-8 h-80 w-full rounded-2xl object-cover" />
      <div className="mt-8 space-y-4 text-[17px] leading-8 text-zinc-300">
        {post.body.split('\n\n').map((p, i) => (
          <p key={i} className="whitespace-pre-line">{p}</p>
        ))}
      </div>
    </article>
  )
}

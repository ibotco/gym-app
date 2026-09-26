import { Link } from 'react-router-dom'
import { BLOG } from '../../data/seed'

export function Blog() {
  return (
    <div className="mx-auto max-w-7xl px-4 py-16 md:px-6">
      <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-lime">Journal</p>
      <h1 className="font-display mt-2 text-4xl font-semibold md:text-6xl">Notes from the floor.</h1>
      <p className="mt-4 max-w-xl text-mist">Training, nutrition, and the unglamorous work of showing up in Accra weather.</p>
      <div className="mt-12 grid gap-6 md:grid-cols-2">
        {BLOG.map((b) => (
          <Link key={b.id} to={`/blog/${b.slug}`} className="card overflow-hidden">
            <img src={b.image} alt="" className="h-56 w-full object-cover" />
            <div className="p-6">
              <p className="text-[11px] font-bold uppercase tracking-wider text-lime">{b.category} · {b.readMins} min · {b.date}</p>
              <h2 className="font-display mt-2 text-2xl leading-snug">{b.title}</h2>
              <p className="mt-2 text-sm text-mist">{b.excerpt}</p>
              <p className="mt-4 text-xs text-mist">By {b.author}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}

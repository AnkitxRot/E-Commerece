import { Link } from 'react-router-dom';

const SHOP_LINKS = [
  { label: 'Electronics', href: '/c/electronics' },
  { label: 'Computers', href: '/c/computers' },
  { label: 'Audio', href: '/c/audio' },
  { label: 'Home & Kitchen', href: '/c/home-kitchen' },
  { label: 'Fitness', href: '/c/fitness' },
  { label: 'Travel', href: '/c/travel' },
  { label: 'Office', href: '/c/office' },
  { label: 'Lifestyle', href: '/c/lifestyle' },
];

export function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-8 px-6 py-12 sm:grid-cols-4">
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Shop</h2>
          <ul className="flex flex-col gap-2 text-sm text-ink-muted">
            {SHOP_LINKS.map((link) => (
              <li key={link.href}>
                <Link to={link.href} className="hover:text-ink hover:underline">
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Help</h2>
          <ul className="flex flex-col gap-2 text-sm text-ink-muted">
            <li>
              <Link to="/account/orders" className="hover:text-ink hover:underline">
                Order history
              </Link>
            </li>
            <li>
              <Link to="/cart" className="hover:text-ink hover:underline">
                Your cart
              </Link>
            </li>
            <li>
              <Link to="/products" className="hover:text-ink hover:underline">
                All products
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Company</h2>
          <ul className="flex flex-col gap-2 text-sm text-ink-muted">
            <li>
              <Link to="/" className="hover:text-ink hover:underline">
                Home
              </Link>
            </li>
            <li>
              <Link to="/credits" className="hover:text-ink hover:underline">
                Image credits
              </Link>
            </li>
          </ul>
        </div>
        <div>
          <h2 className="mb-3 text-sm font-semibold text-ink">Trust</h2>
          <ul className="flex flex-col gap-2 text-sm text-ink-muted">
            <li>Free shipping over ₹999</li>
            <li>7-day easy returns</li>
            <li>Secure checkout</li>
          </ul>
        </div>
      </div>
      <div className="border-t border-border px-6 py-6 text-center text-xs text-ink-muted">
        This is a demo storefront. No real payments are processed.
      </div>
    </footer>
  );
}

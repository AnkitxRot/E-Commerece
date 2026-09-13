import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import type { ZodError } from 'zod';
import {
  ProductStatus,
  adminBrandsResponseSchema,
  adminCategoriesResponseSchema,
  adminProductResponseSchema,
  createProductInputSchema,
  updateProductInputSchema,
  updateVariantInputSchema,
  type AdminOptionDto,
  type AdminProductDetailDto,
} from '@audio-commerce/shared';
import { ApiError, apiFetch } from '../lib/apiClient.js';
import { parseCatalog } from '../lib/parseCatalog.js';
import { Button } from '../components/Button.js';
import { Input } from '../components/Input.js';
import { ErrorState } from '../components/ErrorState.js';
import { Skeleton } from '../components/Skeleton.js';

type AttributeRow = { key: string; value: string };

const inr = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR' });

function slugify(value: string): string {
  return value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function collectFieldErrors(error: ZodError): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.') || 'form';
    if (!errors[key]) errors[key] = issue.message;
  }
  return errors;
}

export default function AdminProductFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [categories, setCategories] = useState<AdminOptionDto[] | null>(null);
  const [brands, setBrands] = useState<AdminOptionDto[] | null>(null);
  const [product, setProduct] = useState<AdminProductDetailDto | null>(null);
  const [loadError, setLoadError] = useState<Error | null>(null);

  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [slugTouched, setSlugTouched] = useState(false);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState('');
  const [brandId, setBrandId] = useState('');
  const [basePrice, setBasePrice] = useState('');
  const [status, setStatus] = useState<string>(ProductStatus.DRAFT);
  const [featured, setFeatured] = useState(false);
  const [sku, setSku] = useState('');
  const [stockQty, setStockQty] = useState('0');
  const [lowStockThreshold, setLowStockThreshold] = useState('5');
  const [attributes, setAttributes] = useState<AttributeRow[]>([{ key: 'Color', value: '' }]);

  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const [variantEdits, setVariantEdits] = useState<Record<string, { stockQty: string; lowStockThreshold: string }>>(
    {},
  );
  const [variantSavingId, setVariantSavingId] = useState<string | null>(null);
  const [variantError, setVariantError] = useState<string | null>(null);

  useEffect(() => {
    const ac = new AbortController();
    let cancelled = false;

    async function load() {
      setLoadError(null);
      try {
        const [categoriesData, brandsData] = await Promise.all([
          apiFetch('/api/admin/categories', { signal: ac.signal }),
          apiFetch('/api/admin/brands', { signal: ac.signal }),
        ]);
        if (cancelled) return;
        setCategories(parseCatalog(adminCategoriesResponseSchema, categoriesData).categories);
        setBrands(parseCatalog(adminBrandsResponseSchema, brandsData).brands);

        if (id) {
          const detailData = await apiFetch(`/api/admin/products/${id}`, { signal: ac.signal });
          if (cancelled) return;
          const detail = parseCatalog(adminProductResponseSchema, detailData).product;
          setProduct(detail);
          setName(detail.name);
          setSlug(detail.slug);
          setSlugTouched(true);
          setDescription(detail.description);
          setCategoryId(detail.categoryId);
          setBrandId(detail.brandId ?? '');
          setBasePrice(detail.basePrice);
          setStatus(detail.status);
          setFeatured(detail.featured);
          setVariantEdits(
            Object.fromEntries(
              detail.variants.map((v) => [
                v.id,
                { stockQty: String(v.stockQty), lowStockThreshold: String(v.lowStockThreshold) },
              ]),
            ),
          );
        }
      } catch (err) {
        if (!cancelled) setLoadError(err instanceof Error ? err : new Error('Request failed'));
      }
    }

    void load();
    return () => {
      cancelled = true;
      ac.abort();
    };
  }, [id]);

  function handleNameChange(value: string) {
    setName(value);
    if (!isEdit && !slugTouched) setSlug(slugify(value));
  }

  function updateAttribute(index: number, field: 'key' | 'value', value: string) {
    setAttributes((prev) => prev.map((row, i) => (i === index ? { ...row, [field]: value } : row)));
  }

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setFieldErrors({});
    setServerError(null);

    if (isEdit && id) {
      const result = updateProductInputSchema.safeParse({
        name,
        description,
        categoryId,
        brandId: brandId || null,
        basePrice,
        status,
        featured,
      });
      if (!result.success) {
        setFieldErrors(collectFieldErrors(result.error));
        return;
      }
      setSubmitting(true);
      try {
        await apiFetch(`/api/admin/products/${id}`, { method: 'PATCH', body: JSON.stringify(result.data) });
        navigate('/admin/products');
      } catch (err) {
        setServerError(err instanceof ApiError ? err.message : 'Unable to save this product right now.');
      } finally {
        setSubmitting(false);
      }
      return;
    }

    const attrsObject = Object.fromEntries(
      attributes.filter((row) => row.key.trim() && row.value.trim()).map((row) => [row.key.trim(), row.value.trim()]),
    );
    const result = createProductInputSchema.safeParse({
      slug,
      name,
      description,
      categoryId,
      brandId: brandId || null,
      basePrice,
      status,
      featured,
      variants: [{ sku, attributes: attrsObject, stockQty: Number(stockQty), lowStockThreshold: Number(lowStockThreshold) }],
    });
    if (!result.success) {
      setFieldErrors(collectFieldErrors(result.error));
      return;
    }
    setSubmitting(true);
    try {
      await apiFetch('/api/admin/products', { method: 'POST', body: JSON.stringify(result.data) });
      navigate('/admin/products');
    } catch (err) {
      setServerError(err instanceof ApiError ? err.message : 'Unable to create this product right now.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleVariantSave(variantId: string) {
    if (!product) return;
    const edit = variantEdits[variantId];
    const result = updateVariantInputSchema.safeParse({
      stockQty: Number(edit.stockQty),
      lowStockThreshold: Number(edit.lowStockThreshold),
    });
    if (!result.success) {
      setVariantError(result.error.issues[0]?.message ?? 'Invalid variant values');
      return;
    }
    setVariantSavingId(variantId);
    setVariantError(null);
    try {
      const data = await apiFetch(`/api/admin/products/${product.id}/variants/${variantId}`, {
        method: 'PATCH',
        body: JSON.stringify(result.data),
      });
      setProduct(parseCatalog(adminProductResponseSchema, data).product);
    } catch (err) {
      setVariantError(err instanceof ApiError ? err.message : 'Unable to update this variant right now.');
    } finally {
      setVariantSavingId(null);
    }
  }

  if (loadError) {
    return <ErrorState title="Unable to load this page" description={loadError.message} />;
  }

  if (!categories || !brands || (isEdit && !product)) {
    return (
      <div className="flex flex-col gap-4">
        <Skeleton className="h-8 w-1/3" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <h1 className="text-2xl font-semibold text-ink">{isEdit ? `Edit ${product?.name}` : 'New product'}</h1>

      <form onSubmit={handleSubmit} noValidate className="flex max-w-2xl flex-col gap-4">
        <Input id="name" label="Name" value={name} error={fieldErrors.name} onChange={(e) => handleNameChange(e.target.value)} />
        <Input
          id="slug"
          label="Slug"
          value={slug}
          disabled={isEdit}
          error={fieldErrors.slug}
          onChange={(e) => {
            setSlugTouched(true);
            setSlug(e.target.value);
          }}
        />
        <div className="flex flex-col gap-1">
          <label htmlFor="description" className="text-sm font-medium text-ink">
            Description
          </label>
          <textarea
            id="description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
          />
          {fieldErrors.description && (
            <p role="alert" className="text-sm text-danger">
              {fieldErrors.description}
            </p>
          )}
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="categoryId" className="text-sm font-medium text-ink">
              Category
            </label>
            <select
              id="categoryId"
              value={categoryId}
              onChange={(e) => setCategoryId(e.target.value)}
              className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">Select a category</option>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
            {fieldErrors.categoryId && (
              <p role="alert" className="text-sm text-danger">
                {fieldErrors.categoryId}
              </p>
            )}
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="brandId" className="text-sm font-medium text-ink">
              Brand (optional)
            </label>
            <select
              id="brandId"
              value={brandId}
              onChange={(e) => setBrandId(e.target.value)}
              className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value="">None</option>
              {brands.map((brand) => (
                <option key={brand.id} value={brand.id}>
                  {brand.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Input
            id="basePrice"
            label="Base price (₹)"
            value={basePrice}
            error={fieldErrors.basePrice}
            onChange={(e) => setBasePrice(e.target.value)}
            placeholder="1999.00"
          />
          <div className="flex flex-col gap-1">
            <label htmlFor="status" className="text-sm font-medium text-ink">
              Status
            </label>
            <select
              id="status"
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="rounded-sm border border-border bg-bg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-accent"
            >
              <option value={ProductStatus.DRAFT}>Draft</option>
              <option value={ProductStatus.ACTIVE}>Active</option>
              <option value={ProductStatus.ARCHIVED}>Archived</option>
            </select>
          </div>
        </div>

        <label className="flex items-center gap-2 text-sm text-ink">
          <input type="checkbox" checked={featured} onChange={(e) => setFeatured(e.target.checked)} />
          Featured on the homepage
        </label>

        {!isEdit && (
          <fieldset className="flex flex-col gap-4 rounded-lg border border-border p-4">
            <legend className="px-1 text-sm font-medium text-ink">Initial variant</legend>
            <Input id="sku" label="SKU" value={sku} error={fieldErrors['variants.0.sku']} onChange={(e) => setSku(e.target.value)} />
            <div className="flex flex-col gap-2">
              <p className="text-sm font-medium text-ink">Attributes</p>
              {attributes.map((row, index) => (
                <div key={index} className="flex gap-2">
                  <Input
                    id={`attr-key-${index}`}
                    label="Attribute name"
                    value={row.key}
                    onChange={(e) => updateAttribute(index, 'key', e.target.value)}
                  />
                  <Input
                    id={`attr-value-${index}`}
                    label="Attribute value"
                    value={row.value}
                    onChange={(e) => updateAttribute(index, 'value', e.target.value)}
                  />
                </div>
              ))}
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <Input
                id="stockQty"
                label="Stock quantity"
                type="number"
                min={0}
                value={stockQty}
                error={fieldErrors['variants.0.stockQty']}
                onChange={(e) => setStockQty(e.target.value)}
              />
              <Input
                id="lowStockThreshold"
                label="Low-stock threshold"
                type="number"
                min={0}
                value={lowStockThreshold}
                onChange={(e) => setLowStockThreshold(e.target.value)}
              />
            </div>
          </fieldset>
        )}

        {serverError && (
          <p role="alert" className="text-sm text-danger">
            {serverError}
          </p>
        )}

        <Button type="submit" loading={submitting} className="mt-2 self-start">
          {isEdit ? 'Save changes' : 'Create product'}
        </Button>
      </form>

      {isEdit && product && (
        <div>
          <h2 className="mb-3 text-lg font-semibold text-ink">Variants &amp; stock</h2>
          {variantError && (
            <p role="alert" className="mb-2 text-sm text-danger">
              {variantError}
            </p>
          )}
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-ink-muted">
                  <th className="px-4 py-2 font-medium">SKU</th>
                  <th className="px-4 py-2 font-medium">Price</th>
                  <th className="px-4 py-2 font-medium">Stock</th>
                  <th className="px-4 py-2 font-medium">Threshold</th>
                  <th className="px-4 py-2 font-medium" />
                </tr>
              </thead>
              <tbody>
                {product.variants.map((variant) => {
                  const edit = variantEdits[variant.id] ?? { stockQty: '0', lowStockThreshold: '5' };
                  return (
                    <tr key={variant.id} className="border-b border-border last:border-0">
                      <td className="px-4 py-2 text-ink-muted">{variant.sku}</td>
                      <td className="px-4 py-2 text-ink-muted">
                        {inr.format(Number(variant.priceOverride ?? product.basePrice))}
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          aria-label={`Stock for ${variant.sku}`}
                          value={edit.stockQty}
                          onChange={(e) =>
                            setVariantEdits((prev) => ({ ...prev, [variant.id]: { ...edit, stockQty: e.target.value } }))
                          }
                          className="w-24 rounded-sm border border-border bg-bg px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <input
                          type="number"
                          min={0}
                          aria-label={`Low-stock threshold for ${variant.sku}`}
                          value={edit.lowStockThreshold}
                          onChange={(e) =>
                            setVariantEdits((prev) => ({
                              ...prev,
                              [variant.id]: { ...edit, lowStockThreshold: e.target.value },
                            }))
                          }
                          className="w-24 rounded-sm border border-border bg-bg px-2 py-1 text-sm"
                        />
                      </td>
                      <td className="px-4 py-2">
                        <Button
                          type="button"
                          variant="secondary"
                          loading={variantSavingId === variant.id}
                          onClick={() => void handleVariantSave(variant.id)}
                        >
                          Save
                        </Button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

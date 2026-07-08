import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const maxDuration = 15;

type SchemaType = 'Organization' | 'Article' | 'Product' | 'LocalBusiness';

interface GenerateBody {
  type?: SchemaType;
  data?: Record<string, string>;
}

function str(data: Record<string, string>, key: string, fallback = ''): string {
  const v = data[key];
  if (v === undefined || v === null) return fallback;
  return String(v).trim();
}

function splitList(value: string): string[] {
  if (!value) return [];
  return value
    .split(/[,\n]/)
    .map((s) => s.trim())
    .filter(Boolean);
}

function buildOrganization(data: Record<string, string>) {
  const name = str(data, 'name', 'Your Organization');
  const url = str(data, 'url', 'https://example.com');
  const logo = str(data, 'logo');
  const description = str(data, 'description');
  const email = str(data, 'email');
  const phone = str(data, 'phone');
  const socials = splitList(str(data, 'sameAs'));

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Organization',
    name,
    url,
  };

  if (logo) schema.logo = logo;
  if (description) schema.description = description;
  if (email) schema.email = email;
  if (phone) {
    schema.contactPoint = [
      {
        '@type': 'ContactPoint',
        telephone: phone,
        contactType: 'customer service',
      },
    ];
  }
  if (socials.length > 0) schema.sameAs = socials;

  return schema;
}

function buildArticle(data: Record<string, string>) {
  const headline = str(data, 'headline', 'Article Headline');
  const author = str(data, 'author', 'Author Name');
  const datePublished = str(
    data,
    'datePublished',
    new Date().toISOString().split('T')[0]
  );
  const dateModified = str(data, 'dateModified') || datePublished;
  const image = str(data, 'image');
  const publisherName = str(data, 'publisher', 'Publisher');
  const publisherLogo = str(data, 'publisherLogo');
  const url = str(data, 'url', 'https://example.com/article');

  const publisher: Record<string, unknown> = {
    '@type': 'Organization',
    name: publisherName,
  };
  if (publisherLogo) {
    publisher.logo = { '@type': 'ImageObject', url: publisherLogo };
  }

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Article',
    headline,
    author: { '@type': 'Person', name: author },
    publisher,
    datePublished,
    dateModified,
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
  };

  if (image) schema.image = image;

  return schema;
}

function buildProduct(data: Record<string, string>) {
  const name = str(data, 'name', 'Product Name');
  const description = str(data, 'description');
  const brand = str(data, 'brand');
  const image = str(data, 'image');
  const sku = str(data, 'sku');
  const price = str(data, 'price');
  const currency = str(data, 'currency', 'USD');
  const availability = str(
    data,
    'availability',
    'https://schema.org/InStock'
  );
  const ratingValue = str(data, 'ratingValue');
  const reviewCount = str(data, 'reviewCount');

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name,
  };

  if (description) schema.description = description;
  if (brand) schema.brand = { '@type': 'Brand', name: brand };
  if (image) schema.image = image;
  if (sku) schema.sku = sku;

  if (price) {
    schema.offers = {
      '@type': 'Offer',
      price,
      priceCurrency: currency,
      availability,
    };
  }

  if (ratingValue && reviewCount) {
    schema.aggregateRating = {
      '@type': 'AggregateRating',
      ratingValue,
      reviewCount,
    };
  }

  return schema;
}

function buildLocalBusiness(data: Record<string, string>) {
  const name = str(data, 'name', 'Business Name');
  const url = str(data, 'url', 'https://example.com');
  const telephone = str(data, 'telephone');
  const streetAddress = str(data, 'streetAddress');
  const addressLocality = str(data, 'addressLocality');
  const addressRegion = str(data, 'addressRegion');
  const postalCode = str(data, 'postalCode');
  const addressCountry = str(data, 'addressCountry', 'US');
  const latitude = str(data, 'latitude');
  const longitude = str(data, 'longitude');
  const openingHours = str(data, 'openingHours', 'Mo-Fr 09:00-17:00');
  const image = str(data, 'image');
  const priceRange = str(data, 'priceRange');

  const schema: Record<string, unknown> = {
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name,
    url,
  };

  if (telephone) schema.telephone = telephone;
  if (priceRange) schema.priceRange = priceRange;
  if (image) schema.image = image;

  if (streetAddress || addressLocality) {
    schema.address = {
      '@type': 'PostalAddress',
      ...(streetAddress ? { streetAddress } : {}),
      ...(addressLocality ? { addressLocality } : {}),
      ...(addressRegion ? { addressRegion } : {}),
      ...(postalCode ? { postalCode } : {}),
      addressCountry,
    };
  }

  if (openingHours) {
    schema.openingHours = openingHours;
  }

  if (latitude && longitude) {
    schema.geo = {
      '@type': 'GeoCoordinates',
      latitude,
      longitude,
    };
  }

  return schema;
}

export async function POST(request: NextRequest) {
  try {
    const { type, data } = (await request.json()) as GenerateBody;

    if (!type) {
      return NextResponse.json(
        { success: false, error: 'Schema "type" is required.' },
        { status: 400 }
      );
    }

    const safeData: Record<string, string> = data || {};

    let schemaObj: Record<string, unknown>;
    switch (type) {
      case 'Organization':
        schemaObj = buildOrganization(safeData);
        break;
      case 'Article':
        schemaObj = buildArticle(safeData);
        break;
      case 'Product':
        schemaObj = buildProduct(safeData);
        break;
      case 'LocalBusiness':
        schemaObj = buildLocalBusiness(safeData);
        break;
      default:
        return NextResponse.json(
          {
            success: false,
            error: `Unsupported schema type: ${type}. Supported: Organization, Article, Product, LocalBusiness.`,
          },
          { status: 400 }
        );
    }

    const schema = JSON.stringify(schemaObj, null, 2);
    const html = `<script type="application/ld+json">\n${schema}\n</script>`;

    return NextResponse.json({
      success: true,
      type,
      schema,
      html,
      parsed: schemaObj,
    });
  } catch (error: unknown) {
    console.error('[seo/schema-generate] error:', error);
    const message =
      error instanceof Error ? error.message : 'Schema generation failed';
    return NextResponse.json(
      { success: false, error: message },
      { status: 500 }
    );
  }
}

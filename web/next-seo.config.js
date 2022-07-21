const SEO = {
    openGraph: {
        type: 'website',
        locale: 'en_us',
        // url: process.env.NEXT_PUBLIC_SITE_URL || 'https://fhfhockey.com',
        site_name: 'Five Hole Fantasy Hockey',
        // default og image
        images: [
            {
                url: `${process.env.NEXT_PUBLIC_SITE_URL}/pictures/circle.png`,
                alt: "logo",
            },
        ],
    },
    twitter: {
        handle: '@FHFHockey',
        site: '@FHFHockey',
        cardType: 'summary_large_image',
    },
};

export default SEO;
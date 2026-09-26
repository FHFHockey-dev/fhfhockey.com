import { SITE_URL } from './lib/seo';

const SEO = {
    defaultTitle: 'Five Hole Fantasy Hockey | NHL Tools & Analysis',
    description: 'Fantasy hockey tools, NHL player statistics, schedule planning, articles, and the Five Hole Fantasy Hockey podcast.',
    openGraph: {
        type: 'website',
        locale: 'en_US',
        site_name: 'Five Hole Fantasy Hockey',
        // default og image
        images: [
            {
                url: `${SITE_URL}/pictures/circle.png`,
                alt: "Five Hole Fantasy Hockey",
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

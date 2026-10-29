export const ticketCategoryOrder = [
  'VVIP',
  'VIP',
  'General Admission',
  'School',
  'Media',
  'Staff',
];

export const mockEvents = [
  {
    id: 'royal-thomian-t20-2026',
    name: 'Royal-Thomian T20 Night Clash',
    date: '2026-05-12',
    time: '6:30 PM',
    venue: 'R. Premadasa Stadium, Colombo',
    city: 'Colombo',
    thumbnail:
      'https://images.unsplash.com/photo-1517927033932-b3d18e61fb3a?auto=format&fit=crop&w=1200&q=80',
    shortDescription:
      'An under-lights school cricket showdown with premium hospitality lounges and family-friendly access zones.',
    description:
      'The Royal-Thomian T20 Night Clash brings school cricket energy to a full-scale stadium experience. Guests can choose from premium hospitality, grandstand access, school supporter sections, accredited media lanes, and operational staff access.',
    availability: 'Selling Fast',
    categories: [
      {
        id: 'vvip',
        name: 'VVIP',
        price: 25000,
        capacity: 120,
        sold: 96,
        benefits: ['Presidential lounge entry', 'Pitch-view hospitality deck', 'VIP parking pass'],
        zones: ['Gate A Priority', 'VVIP Lounge', 'Hospitality Deck', 'Pitchside Club'],
      },
      {
        id: 'vip',
        name: 'VIP',
        price: 14000,
        capacity: 300,
        sold: 214,
        benefits: ['Covered grandstand seat', 'Fast-track entry', 'Complimentary refreshments'],
        zones: ['Gate B Express', 'VIP Grandstand', 'Refreshment Terrace'],
      },
      {
        id: 'general',
        name: 'General Admission',
        price: 4500,
        capacity: 3500,
        sold: 2275,
        benefits: ['East stand seating', 'Food court access', 'Merchandise concourse'],
        zones: ['East Stand', 'Food Court', 'Merch Concourse'],
      },
      {
        id: 'school',
        name: 'School',
        price: 2500,
        capacity: 900,
        sold: 540,
        benefits: ['Dedicated student block', 'School fan zone', 'Supervised group entry'],
        zones: ['School Fan Zone', 'Student Block', 'Food Court'],
      },
      {
        id: 'media',
        name: 'Media',
        price: 0,
        capacity: 80,
        sold: 41,
        benefits: ['Media workroom', 'Mixed zone access', 'Photographer platform'],
        zones: ['Media Gate', 'Press Box', 'Mixed Zone', 'Photo Platform'],
      },
      {
        id: 'staff',
        name: 'Staff',
        price: 0,
        capacity: 220,
        sold: 162,
        benefits: ['Back-of-house circulation', 'Operational briefing room', 'Staff meal point'],
        zones: ['Staff Entry', 'Operations Room', 'Service Corridor', 'Staff Meal Point'],
      },
    ],
  },
  {
    id: 'colombo-summer-music-fest',
    name: 'Colombo Summer Music Fest',
    date: '2026-06-07',
    time: '4:00 PM',
    venue: 'Galle Face Green Arena, Colombo',
    city: 'Colombo',
    thumbnail:
      'https://images.unsplash.com/photo-1501386761578-eac5c94b800a?auto=format&fit=crop&w=1200&q=80',
    shortDescription:
      'A waterfront live music festival with stage-front premium decks, lounge seating, and public fan zones.',
    description:
      'Colombo Summer Music Fest is a multi-artist outdoor concert built for high-energy crowds, sunset views, and premium guest experiences. Ticket types span front-of-stage access, seated hospitality, student pricing, accredited media zones, and staff circulation areas.',
    availability: 'Available',
    categories: [
      {
        id: 'vvip',
        name: 'VVIP',
        price: 30000,
        capacity: 90,
        sold: 48,
        benefits: ['Artist hospitality lounge', 'Front-stage viewing deck', 'Premium beverage service'],
        zones: ['Gate A Priority', 'Artist Lounge', 'Front-Stage Deck', 'VIP Bar'],
      },
      {
        id: 'vip',
        name: 'VIP',
        price: 18000,
        capacity: 260,
        sold: 133,
        benefits: ['Elevated lounge seating', 'Fast-track wristband collection', 'Dedicated bar line'],
        zones: ['Gate B Express', 'VIP Lounge', 'VIP Bar'],
      },
      {
        id: 'general',
        name: 'General Admission',
        price: 6000,
        capacity: 5000,
        sold: 1950,
        benefits: ['Festival grounds access', 'Main stage viewing lawn', 'Food village access'],
        zones: ['Festival Lawn', 'Main Stage Front', 'Food Village'],
      },
      {
        id: 'school',
        name: 'School',
        price: 3000,
        capacity: 600,
        sold: 268,
        benefits: ['Discounted student pass', 'Grouped school entry lane', 'Supervised support area'],
        zones: ['Student Lane', 'Festival Lawn', 'Food Village'],
      },
      {
        id: 'media',
        name: 'Media',
        price: 0,
        capacity: 60,
        sold: 29,
        benefits: ['Press workroom', 'Side-stage media pen', 'Interview backdrop access'],
        zones: ['Media Gate', 'Press Workroom', 'Media Pen', 'Interview Backdrop'],
      },
      {
        id: 'staff',
        name: 'Staff',
        price: 0,
        capacity: 180,
        sold: 112,
        benefits: ['Operations command access', 'Backstage corridor', 'Staff catering point'],
        zones: ['Staff Entry', 'Ops Command', 'Backstage Corridor', 'Staff Catering'],
      },
    ],
  },
  {
    id: 'future-of-sport-summit',
    name: 'Future of Sport Summit 2026',
    date: '2026-07-18',
    time: '9:00 AM',
    venue: 'BMICH, Colombo',
    city: 'Colombo',
    thumbnail:
      'https://images.unsplash.com/photo-1511578314322-379afb476865?auto=format&fit=crop&w=1200&q=80',
    shortDescription:
      'A multi-track conference on fan engagement, venue operations, and premium access design for large events.',
    description:
      'The Future of Sport Summit gathers organisers, venue operators, schools, and media leaders for a day of panels, demos, and networking. The ticket structure mirrors role-based access needs, from premium executive lounges to school delegations and accredited production teams.',
    availability: 'Limited',
    categories: [
      {
        id: 'vvip',
        name: 'VVIP',
        price: 22000,
        capacity: 70,
        sold: 62,
        benefits: ['Executive lounge access', 'Speaker meet-and-greet', 'Reserved front-row seating'],
        zones: ['Priority Registration', 'Executive Lounge', 'Main Hall Front Row'],
      },
      {
        id: 'vip',
        name: 'VIP',
        price: 12000,
        capacity: 180,
        sold: 149,
        benefits: ['Premium reserved seating', 'Networking brunch', 'Fast-track registration'],
        zones: ['VIP Registration', 'Main Hall Premium', 'Networking Lounge'],
      },
      {
        id: 'general',
        name: 'General Admission',
        price: 5500,
        capacity: 900,
        sold: 688,
        benefits: ['Conference hall access', 'Expo floor access', 'Session recordings'],
        zones: ['Main Hall', 'Expo Floor', 'Networking Commons'],
      },
      {
        id: 'school',
        name: 'School',
        price: 2000,
        capacity: 200,
        sold: 131,
        benefits: ['Student track access', 'Mentor clinic entry', 'Group registration support'],
        zones: ['Student Track', 'Expo Floor', 'Mentor Clinic'],
      },
      {
        id: 'media',
        name: 'Media',
        price: 0,
        capacity: 45,
        sold: 33,
        benefits: ['Press briefing room', 'Interview suite access', 'Photography bay'],
        zones: ['Media Desk', 'Press Room', 'Interview Suite', 'Photo Bay'],
      },
      {
        id: 'staff',
        name: 'Staff',
        price: 0,
        capacity: 95,
        sold: 81,
        benefits: ['Operations room access', 'Speaker holding area', 'Logistics corridor'],
        zones: ['Staff Check-In', 'Operations Room', 'Speaker Holding', 'Logistics Corridor'],
      },
    ],
  },
];

export const ticketCategories = ticketCategoryOrder;

export const availabilityOptions = ['All', 'Available', 'Selling Fast', 'Limited', 'Sold Out'];

export const getEventById = (id) => mockEvents.find((event) => event.id === id);

export const getAllZones = (event) =>
  Array.from(new Set(event.categories.flatMap((category) => category.zones)));

export const getCategoryRemaining = (category) => Math.max(category.capacity - category.sold, 0);

export const getEventAvailability = (event) => {
  const remaining = event.categories.reduce(
    (sum, category) => sum + getCategoryRemaining(category),
    0
  );

  if (remaining === 0) return 'Sold Out';
  if (remaining < 100) return 'Limited';
  return event.availability;
};

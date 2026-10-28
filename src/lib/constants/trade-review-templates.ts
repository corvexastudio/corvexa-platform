export interface TradeReviewTemplate {
  id: string
  name: string
  shortName: string
  category: string
  template: string
}

export const TRADE_REVIEW_TEMPLATES: TradeReviewTemplate[] = [
  {
    id: 'general',
    name: 'General Home Service',
    shortName: 'General',
    category: 'Universal',
    template: 'Thanks for choosing {business_name} today! We would really appreciate your honest feedback. You can leave us a Google review here: {review_link}'
  },
  {
    id: 'hvac',
    name: 'HVAC & Heating / Cooling',
    shortName: 'HVAC',
    category: 'Mechanical',
    template: 'Thanks for choosing {business_name} for your HVAC service today! If our technician took great care of your system, could you share a quick review on Google: {review_link}'
  },
  {
    id: 'plumbing',
    name: 'Plumbing & Drain Cleaning',
    shortName: 'Plumbing',
    category: 'Mechanical',
    template: 'Thank you for trusting {business_name} with your plumbing repair today! We would really appreciate your honest feedback on Google: {review_link}'
  },
  {
    id: 'electrical',
    name: 'Electrical & Lighting',
    shortName: 'Electrical',
    category: 'Mechanical',
    template: 'Thanks for choosing {business_name} for your electrical project! If our team did great work, could you take 30 seconds to review us on Google: {review_link}'
  },
  {
    id: 'roofing',
    name: 'Roofing & Gutters',
    shortName: 'Roofing',
    category: 'Exterior',
    template: 'Thank you for choosing {business_name} for your roofing service! We would really appreciate your honest feedback on Google: {review_link}'
  },
  {
    id: 'landscaping',
    name: 'Landscaping & Lawn Care',
    shortName: 'Landscaping',
    category: 'Exterior',
    template: 'Thanks for trusting {business_name} with your property today! We would love your honest review on Google: {review_link}'
  },
  {
    id: 'pest_control',
    name: 'Pest & Termite Control',
    shortName: 'Pest Control',
    category: 'Specialty',
    template: 'Thank you for choosing {business_name} for your pest control service! If our technician took great care of your home, please leave us a review: {review_link}'
  },
  {
    id: 'painting',
    name: 'Painting & Drywall',
    shortName: 'Painting',
    category: 'Finishes',
    template: 'Thanks for choosing {business_name} for your painting project! We hope you love the results. Please share your experience on Google: {review_link}'
  },
  {
    id: 'carpentry',
    name: 'Carpentry & Framing',
    shortName: 'Carpentry',
    category: 'Structure',
    template: 'Thank you for having {business_name} work on your carpentry project! We would really appreciate your feedback on Google: {review_link}'
  },
  {
    id: 'appliance_repair',
    name: 'Appliance Repair',
    shortName: 'Appliance',
    category: 'Mechanical',
    template: 'Thanks for choosing {business_name} to repair your appliance today! If our technician was prompt and helpful, please leave us a review: {review_link}'
  },
  {
    id: 'pool_service',
    name: 'Pool & Spa Service',
    shortName: 'Pool Service',
    category: 'Outdoor',
    template: 'Thank you for choosing {business_name} for your pool service! We appreciate your business and would love your review on Google: {review_link}'
  },
  {
    id: 'locksmith',
    name: 'Locksmith & Security',
    shortName: 'Locksmith',
    category: 'Security',
    template: 'Thanks for calling {business_name} for your locksmith service today! If we helped you out, could you leave a quick Google review: {review_link}'
  },
  {
    id: 'garage_door',
    name: 'Garage Door Repair & Install',
    shortName: 'Garage Door',
    category: 'Mechanical',
    template: 'Thank you for trusting {business_name} with your garage door service! If your door is running smoothly, we would appreciate a review: {review_link}'
  },
  {
    id: 'handyman',
    name: 'Handyman & Home Repairs',
    shortName: 'Handyman',
    category: 'General',
    template: 'Thanks for choosing {business_name} for your home repairs today! We would really appreciate your honest review on Google: {review_link}'
  },
  {
    id: 'flooring',
    name: 'Flooring & Tile Installation',
    shortName: 'Flooring',
    category: 'Finishes',
    template: 'Thank you for having {business_name} install your flooring! We hope you love how it looks. Please share your experience on Google: {review_link}'
  },
  {
    id: 'cleaning',
    name: 'Cleaning & Janitorial',
    shortName: 'Cleaning',
    category: 'Maintenance',
    template: 'Thanks for choosing {business_name} for your cleaning service! If our team left your space spotless, could you leave a review on Google: {review_link}'
  },
  {
    id: 'tree_service',
    name: 'Tree Service & Removal',
    shortName: 'Tree Service',
    category: 'Outdoor',
    template: 'Thank you for choosing {business_name} for your tree care service! If our crew worked safely and efficiently, please review us on Google: {review_link}'
  },
  {
    id: 'solar',
    name: 'Solar & Energy Solutions',
    shortName: 'Solar',
    category: 'Energy',
    template: 'Thanks for choosing {business_name} for your solar installation! We would appreciate your honest review on Google: {review_link}'
  },
  {
    id: 'chimney',
    name: 'Chimney Sweep & Inspection',
    shortName: 'Chimney',
    category: 'Specialty',
    template: 'Thank you for trusting {business_name} with your chimney inspection & sweep! Please share your honest feedback on Google: {review_link}'
  },
  {
    id: 'pressure_washing',
    name: 'Pressure Washing & Exterior',
    shortName: 'Pressure Wash',
    category: 'Outdoor',
    template: 'Thanks for choosing {business_name} for your exterior wash! If your property looks fresh, could you leave a review on Google: {review_link}'
  },
  {
    id: 'fencing',
    name: 'Fencing & Gates',
    shortName: 'Fencing',
    category: 'Outdoor',
    template: 'Thank you for choosing {business_name} for your fencing project! We would really appreciate your review on Google: {review_link}'
  },
  {
    id: 'masonry',
    name: 'Masonry & Concrete',
    shortName: 'Masonry',
    category: 'Structure',
    template: 'Thanks for having {business_name} handle your masonry work! We would love your honest review on Google: {review_link}'
  }
]

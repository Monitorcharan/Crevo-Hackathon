// Fictional sample feedback for clearly labeled demo profiles. Never counted as completed Crevo project reviews.
export const demoReviews = {
  '[Demo] Aria Vale': [
    { brand_name: 'Sample brand · Northline', project_title: 'Illustrative launch campaign', rating: 5, body: 'The visual direction made our imagined launch feel cinematic and memorable.' },
    { brand_name: 'Sample brand · Orbit Studio', project_title: 'Illustrative concept film', rating: 4, body: 'Strong composition and a clear sense of pace across the concept frames.' },
  ],
  '[Demo] Kian Mercer': [
    { brand_name: 'Sample brand · Form Lab', project_title: 'Illustrative motion concept', rating: 5, body: 'The material study shows a thoughtful approach to light, movement, and form.' },
    { brand_name: 'Sample brand · Studio North', project_title: 'Illustrative 3D exploration', rating: 5, body: 'A striking visual system with room to develop into a full motion campaign.' },
  ],
  '[Demo] Solana Park': [
    { brand_name: 'Sample brand · Sunday Beauty', project_title: 'Illustrative product campaign', rating: 5, body: 'The color palette and textures give the product a distinct editorial mood.' },
    { brand_name: 'Sample brand · Paper House', project_title: 'Illustrative still-life series', rating: 4, body: 'A polished concept with careful attention to product presentation.' },
  ],
  '[Demo] Niko Lane': [
    { brand_name: 'Sample brand · Side Street', project_title: 'Illustrative fashion story', rating: 5, body: 'Confident styling and color create an energetic campaign direction.' },
    { brand_name: 'Sample brand · Frame Club', project_title: 'Illustrative social campaign', rating: 4, body: 'A bold visual idea that would translate well into short-form assets.' },
  ],
}

export const demoFeedbackFor = creator => creator?.portfolio_source === 'demo' ? (demoReviews[creator.name] || []) : []

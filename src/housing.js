export const constructionSites=[
  [22,3],[22,7],[22,11],[22,15],[7,17],[11,17],[15,17],[19,17],[7,7],[11,4],[15,9],[3,19]
];
export const homeNames=['Ipê','Jatobá','Primavera','Boa Vista','Sereno','Horizonte','Manacá','Jardins','Pioneiros','Estação'];
export const housingCost=(home,tenure)=>tenure==='rent'?home.rent:tenure==='mortgage'?620:90;
export const occupancyRate=home=>home.capacity?home.occupied/home.capacity:0;

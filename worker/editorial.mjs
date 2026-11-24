const editorialPages = {
  '/a-propos':{enPath:'/en/about',page:'about',fr:'L’histoire de TSŪ',en:'The TSŪ story',
    descFr:'TSŪ, le vestiaire otaku imaginé en Belgique. Des références manga à porter et des pièces fabriquées à la demande.',
    descEn:'TSŪ is an otaku wardrobe imagined in Belgium, with manga references you can wear and pieces made to order.'},
  '/faq':{enPath:'/en/faq',page:'faq',fr:'Questions fréquentes',en:'Frequently asked questions',
    descFr:'Fabrication Printful, livraison en Belgique et en France, suivi, tailles, défauts et retours chez TSŪ.',
    descEn:'Printful production, shipping to Belgium and France, tracking, sizing, faults and returns at TSŪ.'},
  '/blog':{enPath:'/en/blog',page:'blog',fr:'Journal manga et anime',en:'Manga and anime journal',
    descFr:'Sorties manga en français, calendriers anime, recommandations sans spoilers et guides streetwear otaku pour les lecteurs en Belgique et en France.',
    descEn:'French-language manga releases, anime schedules, spoiler-free recommendations and otaku streetwear guides for readers in Belgium and France.'},
  '/blog/archives':{enPath:'/en/blog/archive',page:'archive',fr:'Archives du journal',en:'Journal archive',
    descFr:'Toutes les éditions manga et anime du journal TSŪ.',descEn:'All manga and anime editions from the TSŪ journal.'}
};

const editorialLinks = {
  delivery:'https://help.printful.com/hc/en-us/articles/50265132916241-What-s-the-estimated-delivery-time-and-how-is-it-calculated',
  facilities:'https://help.printful.com/hc/en-us/articles/50265294440209-Can-I-choose-where-my-products-are-fulfilled',
  tracking:'https://help.printful.com/hc/en-us/articles/50260934101905-Where-can-I-find-the-tracking-information-for-my-orders',
  split:'https://help.printful.com/hc/en-us/articles/50265136897169-Are-all-products-in-an-order-shipped-together',
  changes:'https://help.printful.com/hc/en-us/articles/50260948753297-Can-I-change-or-cancel-my-order-after-submitting-it',
  help:'https://help.printful.com/hc/en-us/articles/50263870468753-What-is-Printful-s-return-and-refund-policy',
  care:'https://help.printful.com/hc/en-us/articles/50263252811537-How-do-I-take-care-of-my-products',
  belgium:'https://economie.fgov.be/fr/themes/ventes/reglementation/delais-de-retractation/droit-de-retractation-lors-de'
};

const mangaSelection = [
  {title:'Kagurabachi',author:'Takeru Hokazono',publisher:'Kana',release:'2026-11-06',editionFr:'tome 11',editionEn:'volume 11',
    source:'https://www.kana.fr/produit/kagurabachi-t11/',
    fr:'Pour l’action. Chihiro, fils d’un forgeron, hérite d’un monde où les sabres enchantés sont des armes convoitées. Commence au tome 1 si tu veux des duels lisibles, une mise en scène nerveuse et un héros dont les silences comptent.',
    en:'For action. Chihiro, a swordsmith’s son, inherits a world where enchanted blades are coveted weapons. Start at volume one for clear fights, taut pacing and a hero whose silences matter.'},
  {title:'L’Atelier des Sorciers',author:'Kamome Shirahama',publisher:'Pika',release:'2026-11-12',editionFr:'tome 16 collector',editionEn:'volume 16 collector’s edition',
    source:'https://www.pika.fr/livre/latelier-des-sorciers-t16-collector-9791043311772/',
    stream:'https://www.crunchyroll.com/series/GT00258001/witch-hat-atelier',streamTitle:'Crunchyroll',
    availability:'https://www.justwatch.com/be/serie/latelier-des-sorciers',
    fr:'Pour la magie et le dessin. Coco découvre que la magie se trace. Tourne quelques pages du tome 1 et observe les cadres, les tissus et les cercles magiques. Le monde s’apprend par les yeux autant que par l’histoire.',
    en:'For magic and artwork. Coco discovers that magic can be drawn. Open volume one and pay attention to the frames, fabrics and spell circles. You learn the world through its artwork as much as its story.'},
  {title:'SPY × FAMILY',author:'Tatsuya Endo',publisher:'Kurokawa',release:'2026-11-12',editionFr:'tome 17 collector',editionEn:'volume 17 collector’s edition',
    source:'https://www.fnac.com/a23176483/Spy-X-Family-Spy-x-Family-tome-17-collector-Tatsuya-Endo',
    stream:'https://www.crunchyroll.com/series/G4PH0WXVJ/',streamTitle:'Crunchyroll',
    fr:'Pour décrocher après une longue journée. Un espion monte une famille de couverture et chacun garde son propre secret. Le tome 1 fonctionne si tu veux rire sans renoncer à un peu d’action.',
    en:'For unwinding after a long day. A spy puts together a cover family, and everyone has their own secret. Volume one is a good pick if you want laughs with some action.'},
  {title:'Les Carnets de l’apothicaire',author:'Natsu Hyūga, Itsuki Nanao et Nekokurage',publisher:'Ki-oon',release:'2026-11-19',editionFr:'tome 17',editionEn:'volume 17',
    source:'https://ki-oon.com/9791032723531-les-carnets-de-l-apothicaire-edition-simple-volume-17',
    stream:'https://www.crunchyroll.com/fr/series/G3KHEVDJ7/the-apothecary-diaries',streamTitle:'Crunchyroll',
    availability:'https://www.justwatch.com/be/serie/les-carnets-de-lapothicaire',
    fr:'Pour l’enquête. Mao Mao, une apothicaire de palais, remarque ce que les autres laissent passer. Prends le tome 1 de l’édition Ki-oon si tu aimes remonter la piste à partir d’un symptôme, d’un détail ou d’une contradiction.',
    en:'For a mystery. Palace apothecary Maomao notices what other people miss. Pick up volume one of this edition if you like following clues through symptoms, details and contradictions.'},
  {title:'Alice in Borderland',author:'Haro Asō',publisher:'Delcourt',release:'2026-11-19',editionFr:'tome 2 Perfect Edition',editionEn:'volume 2, Perfect Edition',
    source:'https://www.manga-news.com/index.php/manga/Alice-in-Borderland-Perfect-Edition/vol-2',
    stream:'https://www.netflix.com/be-fr/title/80200575',streamTitle:'Netflix Belgique',
    fr:'Pour les jeux psychologiques. Arisu se retrouve dans un Tokyo où il faut comprendre les règles assez vite pour rester en vie. Commence par le tome 1 de la Perfect Edition si tu cherches un récit intense et violent. L’adaptation Netflix est une série en prises de vues réelles.',
    en:'For psychological games. Arisu finds himself in a Tokyo where understanding the rules quickly is a matter of survival. Start with Perfect Edition volume one for an intense, violent story. The Netflix adaptation is live action.'}
];

const upcomingManga = [
  {title:'Shimazaki in the Land of Peace',publisher:'Pika',release:'2026-12-02',editionFr:'tome 6',editionEn:'volume 6',
    source:'https://www.pika.fr/livre/shimazaki-land-peace-t06-9791043308697/'}
];

const journal = [
  {
    slug:'t-shirt-manga-discret',enSlug:'subtle-anime-t-shirt',
    fr:'Le t-shirt manga que seuls les fans reconnaissent',en:'The anime T-shirt only fans recognise',
    descFr:'Trois façons de porter un clin d’œil manga discret, du symbole brodé à la palette de couleurs.',
    descEn:'Three ways to wear a subtle manga reference, from a stitched symbol to a colour palette.',
    sections:[
      ['Choisis le détail qui raconte l’histoire','Pick the detail that tells the story',
        'Un petit emblème, une palette qui évoque une équipe ou une composition inspirée d’une case suffit. Choisis un seul élément que tu aimes vraiment. Mets-le sur la poitrine, la manche ou la nuque pour doser sa présence.',
        'A small emblem, a palette that recalls a team, or a composition inspired by a manga panel can do the job. Choose one detail you genuinely like. Place it on the chest, sleeve or back of the neck to control how visible it is.'],
      ['Teste ton look à deux distances','Test the look at two distances',
        'De loin, regarde si les couleurs et la coupe font une tenue que tu porterais un mardi. De près, demande-toi si le détail ferait sourire quelqu’un qui connaît la référence. Un tee écru, un pantalon sombre et un accent rouge donnent déjà une direction.',
        'From a distance, see whether the colours and fit make an outfit you would wear on a Tuesday. Up close, ask whether the detail would make someone who knows the reference smile. An off-white tee, dark trousers and one red accent give you a direction.']
    ],
    sources:[['UNIQLO Belgique · Collections UT', 'https://www.uniqlo.com/be/fr/special-feature/ut/lineup']]
  },
  {
    slug:'pull-manga-streetwear',enSlug:'anime-hoodie-streetwear',
    fr:'Trois tenues streetwear autour d’un pull manga',en:'Three streetwear looks built around an anime hoodie',
    descFr:'Comment assortir un hoodie manga avec un jean, un cargo ou une veste de travail.',
    descEn:'How to style an anime hoodie with jeans, cargo trousers or a work jacket.',
    sections:[
      ['Le look de tous les jours','The everyday look','Mets un sweat brodé avec un jean droit et des baskets sobres. Si le sweat est ample, regarde où tombe l’ourlet. Une longueur vers le haut des hanches aide à garder une silhouette lisible.','Put an embroidered hoodie with straight jeans and understated trainers. If the hoodie is roomy, check where the hem lands. Around the top of the hips can keep the proportions clean.'],
      ['Le look convention','The convention look','Associe un hoodie de poids moyen à un cargo et des chaussures déjà rodées. Choisis une poche fermée pour ton téléphone et un t-shirt léger dessous si la salle chauffe.','Pair a midweight hoodie with cargos and broken-in shoes. Pick a secure pocket for your phone and wear a light tee underneath if the hall gets warm.'],
      ['Le look du soir','The evening look','Sous une veste de travail, laisse dépasser une seule couleur ou un morceau du motif. Essaie la superposition devant un miroir en bougeant les bras. Tu sauras vite si le pull gêne sous les manches.','Under a work jacket, let one colour or a sliver of the graphic show. Try the layers in a mirror and move your arms. You will quickly know if the sleeves bunch up.']
    ],
    sources:[['UNIQLO Belgique · Collections UT','https://www.uniqlo.com/be/fr/special-feature/ut/lineup'],
      ['Made in Asia Bruxelles · Règlement','https://www.madeinasia.be/fr/reglement/']]
  },
  {
    slug:'cosplay-casual-garcon',enSlug:'casual-anime-cosplay',
    fr:'Cosplay casual pour garçon et ado, trois idées pour débuter',en:'Casual cosplay for boys and teens, three ways to start',
    descFr:'Construire une tenue de convention à partir de pièces ordinaires, avec des idées de poses et de couleurs.',
    descEn:'Build a comfortable convention outfit from everyday clothes, with colour and pose ideas.',
    sections:[
      ['Le héros d’académie','The academy hero','Chemise blanche, pantalon sombre, une cravate ou un badge inventé. Deux couleurs et une posture reconnaissable font une base accessible. Fais le tour de ton placard avant d’acheter quoi que ce soit.','A white shirt, dark trousers and a tie or a badge of your own design. Two colours and a recognisable pose give you an accessible base. Check your wardrobe before buying anything.'],
      ['Le rival en civil','The rival off duty','Pars sur un t-shirt noir, une surchemise claire et un accessoire dans la couleur du personnage. Prends des chaussures confortables et vérifie le règlement de la convention avant de prévoir un accessoire de scène.','Start with a black tee, a light overshirt and an accessory in the character’s colour. Wear comfortable shoes and check the convention’s prop rules before planning any stage accessories.'],
      ['Le sportif en jour de repos','The athlete on a rest day','Un short long, une veste de sport et une paire de chaussettes assortie à l’équipe. Si tu veux une photo qui parle aux fans, pense à un geste ou à une pose propre au personnage.','Try long shorts, a track jacket and socks that match the team colours. For a photo that fans will recognise, choose a character-specific pose or gesture.']
    ],
    sources:[['Made in Asia Bruxelles · Règlement pour les visiteurs et les cosplayers','https://www.madeinasia.be/fr/reglement/']]
  },
  {
    slug:'taille-t-shirt-oversize',enSlug:'oversized-t-shirt-sizing',
    fr:'Coupe droite ou oversize : choisir ta taille sans deviner',en:'Regular or oversized: choose your size without guessing',
    descFr:'Mesurer un t-shirt à plat et comparer la largeur, la longueur et la coupe.',
    descEn:'Measure a favourite shirt flat and compare width, length and fit.',
    sections:[
      ['Prends ton t-shirt préféré','Grab your favourite T-shirt','Pose-le à plat. Mesure la largeur d’aisselle à aisselle, puis la longueur du haut de l’épaule vers le bas. Compare avec les mesures du vêtement de la fiche. Si le tableau indique un tour de poitrine, lis d’abord s’il parle du corps ou du vêtement.','Lay it flat. Measure armpit to armpit, then from the top of the shoulder to the hem. Compare those numbers with the garment measurements on the product page. If a chart lists chest circumference, first check whether it refers to the body or the garment.'],
      ['Regarde les épaules et la longueur séparément','Check shoulders and length separately','Une coupe oversize pensée pour ça peut avoir des épaules tombantes et plus de largeur. Prendre simplement une taille au-dessus peut surtout allonger le t-shirt. Compare les mesures selon le tombé que tu veux.','A deliberate oversized cut can have dropped shoulders and extra width. Going up one size may mostly make the shirt longer. Compare the measurements based on the silhouette you want.']
    ],
    sources:[['Printful · Exemple de tableau de mesures d’un vêtement','https://www.printful.com/custom-products/size-guide?productId=880']]
  },
  {
    slug:'entretien-t-shirt-imprime-brode',enSlug:'printed-and-embroidered-shirt-care',
    fr:'Faire durer un t-shirt manga imprimé ou brodé',en:'Help a printed or embroidered anime T-shirt last',
    descFr:'Les bons gestes d’entretien selon les recommandations de Printful et l’étiquette du vêtement.',
    descEn:'Care tips based on Printful’s instructions and your garment label.',
    sections:[
      ['Pour un motif imprimé','For a printed design','Lis l’étiquette et la fiche du produit. Pour beaucoup de vêtements imprimés, Printful recommande le lavage à froid sur l’envers et un cycle doux. Évite de poser le fer directement sur le motif. Quand le produit le permet, sèche-le à l’air libre.','Read the label and product notes. For many printed garments, Printful recommends cold washing inside out on a gentle cycle. Keep the iron off the print. Air dry when the garment instructions allow it.'],
      ['Pour une broderie ou une casquette','For embroidery or a cap','Consulte les consignes propres à la pièce. Une casquette et un sweat brodé ne s’entretiennent pas forcément de la même façon. Si un fil dépasse, évite de tirer dessus. En cas de défaut à la réception, garde la référence et prends une photo avant de laver la pièce.','Look for the instructions for the exact item. A cap and an embroidered sweatshirt may require different care. If a thread sticks out, avoid pulling it. If you notice a fault on arrival, keep the order reference and take a photo before washing.']
    ],
    sources:[['Printful · Entretien des articles imprimés et brodés',editorialLinks.care]]
  },
  {
    slug:'5-mangas-novembre-2026',enSlug:'five-manga-november-2026',
    fr:'5 mangas à lire en novembre 2026, selon ton humeur',en:'Five manga to read in November 2026, by mood',
    descFr:'Une sélection sans spoilers, avec le bon tome pour commencer et des idées pour passer à l’écran.',
    descEn:'A spoiler-free selection with a starting volume for each series and screen adaptations to try.',
    selection:true
  }
];

function editorialRoute(pathname) {
  const page = editorialPages[pathname];
  if (page) return {...page,path:pathname,en:false,title:page.fr};
  const translated = Object.entries(editorialPages).find(([,page])=>page.enPath===pathname);
  if (translated) return {...translated[1],path:translated[0],en:true,title:translated[1].en};
  const match = /^(\/blog|\/en\/blog)\/([a-z0-9-]+)$/.exec(pathname);
  if (!match) return null;
  const en = match[1]==='/en/blog';
  const weekly = /^(veille|watch)-(\d{4}-\d{2}-\d{2})$/.exec(match[2]);
  if (weekly && weekly[1]===(en?'watch':'veille') && editionDate(weekly[2])) {
    const week=weekly[2];
    return {path:editionPath(week),enPath:editionEnglishPath(week),page:'edition',en,week,title:editionTitle(week,en)};
  }
  const focus = /^(dossier|spotlight)-(\d{4}-\d{2}-\d{2})$/.exec(match[2]);
  if (focus && focus[1]===(en?'spotlight':'dossier') && editionDate(focus[2])) {
    return {path:focusPath(focus[2]),enPath:focusEnglishPath(focus[2]),page:'focus',en,week:focus[2]};
  }
  const managed = /^article-([a-z0-9]+(?:-[a-z0-9]+)*)$/.exec(match[2]);
  if (managed) return {path:journalArticlePath(managed[1]),page:'managed-article',en,slug:managed[1]};
  const article = journal.find(item=>(en?item.enSlug:item.slug)===match[2]);
  return article
    ? {...article,article,path:'/blog/'+article.slug,enPath:'/en/blog/'+article.enSlug,page:'article',en,title:en?article.en:article.fr}
    : {path:'/blog',page:'missing',en};
}

function editorialEnglishPath(path) {
  if (editorialPages[path]) return editorialPages[path].enPath;
  if (/^\/blog\/veille-\d{4}-\d{2}-\d{2}$/.test(path)) return editionEnglishPath(path.slice(-10));
  if (/^\/blog\/dossier-\d{4}-\d{2}-\d{2}$/.test(path)) return focusEnglishPath(path.slice(-10));
  if (path.startsWith('/blog/article-')) return '/en'+path;
  const item = journal.find(article=>path==='/blog/'+article.slug);
  return item ? '/en/blog/'+item.enSlug : '';
}

function externalEditorialLink(label,path) {
  return '<a href="'+htmlEscape(path)+'" target="_blank" rel="noopener">'+htmlEscape(label)+'</a>';
}
function editorialSources(items,en) {
  return '<ul class="editorial-sources" aria-label="'+local(en,'Sources','Sources')+'">'+items.map(([label,path])=>
    '<li>'+externalEditorialLink(label,path)+'</li>').join('')+'</ul>';
}

function aboutEditorial(en) {
  return '<p class="editorial-lead">'+local(en,'Tout a commencé avec un t-shirt que j’avais envie de porter. J’adore les mangas, les vêtements et les accessoires qui en reprennent les codes. Dans la rue, je cherchais ce détail qui fait tilt chez un autre fan. Une broderie, une couleur, un symbole. Un regard suffit, et soudain vous avez une histoire en commun.',
    'It started with a T-shirt I wanted to wear. I love manga and the clothes and accessories that pick up its visual language. On the street, I wanted a detail another fan would catch. A stitch, a colour, a symbol. One glance, and suddenly you share a story.')+'</p>'+
    '<h2>'+local(en,'Les fans reconnaîtront le détail','Fans will catch the detail')+'</h2><p>'+local(en,
      'J’aime les grands visuels d’anime. Pour TSŪ, j’avais envie d’un vestiaire que je peux enfiler pour sortir, bosser ou retrouver des potes, avec des références qu’on remarque de près. Des pièces qui font partie de ta tenue et qui peuvent déclencher un « attends, je connais ce symbole ! ».',
      'I love a big anime graphic. For TSŪ, I wanted clothes I could wear to work, out with friends or around town, with references you notice up close. Pieces that belong in your outfit and might prompt a “wait, I know that symbol!”')+'</p>'+
    '<h2>'+local(en,'Imaginé en Belgique, fabriqué à la demande','Designed in Belgium, made to order')+'</h2><p>'+local(en,
      'TSŪ part de Belgique. On privilégie le circuit le plus court possible dans la limite de ce que notre collection permet. Printful fabrique les pièces après la commande et choisit son atelier selon la disponibilité. C’est une façon d’éviter de produire du stock à l’avance et de laisser plus de place à l’achat réfléchi : une pièce que tu voulais vraiment, que tu vas porter et garder.',
      'TSŪ starts in Belgium. We aim to keep production and delivery as close as our collection allows. Printful makes pieces after you order and chooses a facility based on availability. Making to order helps us avoid producing stock up front and leaves room for a considered purchase: something you genuinely wanted and plan to keep wearing.')+'</p>'+
    '<h2>'+local(en,'Le prochain arc s’écrira à plusieurs','The next arc could have more creators')+'</h2><p>'+local(en,
      'J’aimerais ouvrir TSŪ à des illustrateurs et des créateurs qui ont leur propre univers. Si tu as un motif original ou une idée qui mérite de sortir du carnet, écris-nous. Les meilleurs arcs commencent parfois par une rencontre.',
      'I would like to open TSŪ to illustrators and creators with a world of their own. If you have an original graphic or an idea that deserves to leave your sketchbook, get in touch. Some of the best arcs start with a chance meeting.')+'</p><p>'+
    navLink('/contact',en,'Proposer une collaboration','Pitch a collaboration')+'</p><p>'+
    externalEditorialLink(local(en,'Comment Printful choisit son atelier','How Printful chooses a facility'),editorialLinks.facilities)+'</p>';
}

function faqEditorial(en) {
  const faqs = [
    ['D’où vient TSŪ et qui fabrique les pièces ?','Where is TSŪ based and who makes the pieces?',
      'TSŪ est une boutique basée en Belgique. Printful est notre partenaire de production. Nous proposons la livraison en Belgique et en France. L’atelier dépend du produit et de sa disponibilité.',
      'TSŪ is a Belgium-based shop. Printful is our production partner. We offer delivery to Belgium and France. The facility depends on the product and its availability.',editorialLinks.facilities],
    ['Quand vais-je recevoir ma commande ?','When will I receive my order?',
      'Chaque pièce est fabriquée à la demande. Printful indique que la plupart des commandes prennent 2 à 5 jours ouvrables à fabriquer. Le transport s’ajoute ensuite. Saisis ton code postal dans le panier pour demander une estimation de livraison pour tes articles.',
      'Each piece is made to order. Printful says most orders take 2–5 business days to make. Transit comes afterwards. Enter your postal code in the cart to request a delivery estimate for your items.',editorialLinks.delivery],
    ['Pourquoi ma commande peut-elle arriver en plusieurs colis ?','Why might my order arrive in several parcels?',
      'Printful peut regrouper certains articles et en envoyer d’autres séparément, par exemple quand ils partent d’ateliers différents. Une même commande peut donc avoir plusieurs numéros de suivi.',
      'Printful may group some items and ship others separately, for example if they come from different facilities. One order can have several tracking numbers.',editorialLinks.split],
    ['Où trouver le suivi ?','Where can I find tracking?',
      'Si tu étais connecté au moment de l’achat, ouvre ton espace client et actualise le suivi quand le colis est expédié. Pour une commande invitée ou un suivi bloqué, contacte TSŪ avec ta référence.',
      'If you were signed in when you ordered, open your account and refresh tracking once the parcel is dispatched. For a guest order or stalled tracking, contact TSŪ with your reference.',editorialLinks.tracking],
    ['Puis-je corriger une adresse ou modifier la taille ?','Can I fix an address or change the size?',
      'Contacte TSŪ dès que tu repères l’erreur. Printful permet certaines modifications avant la mise en production. Une fois la fabrication lancée, les possibilités dépendent du statut de la commande.',
      'Contact TSŪ as soon as you notice a mistake. Printful allows some changes before production. Once production has started, the options depend on the order status.',editorialLinks.changes],
    ['L’article est abîmé ou le motif est mal imprimé. Que faire ?','What if my item is damaged or misprinted?',
      'Ouvre un ticket ou contacte TSŪ rapidement, avec la référence, une description et des photos si possible. Printful prévoit une fenêtre de 30 jours pour ses réclamations fournisseur. Contacte-nous même si ce délai est passé : TSŪ traite ta demande et les droits qui s’appliquent à ton achat.',
      'Open a ticket or contact TSŪ promptly with the reference, a description and photos if possible. Printful has a 30-day supplier claims window. Contact us even if it has passed: TSŪ handles your request and the rights that apply to your purchase.',editorialLinks.help],
    ['Et si la taille ne me convient pas ou si je change d’avis ?','What if the size does not suit me or I change my mind?',
      'Printful ne prend généralement pas en charge les changements de taille ou d’avis. En tant que client, adresse ta demande à TSŪ. Pour un produit standard acheté à distance, le droit de rétractation s’applique en principe pendant 14 jours calendrier après réception. Consulte la page Livraison et retours pour la procédure et les exceptions éventuelles.',
      'Printful generally does not cover size changes or a change of mind. As a customer, contact TSŪ. Standard products bought online generally have a 14-calendar-day withdrawal period after delivery. See Shipping and returns for the process and any exceptions.',editorialLinks.belgium],
    ['Comment choisir et entretenir mon vêtement ?','How do I choose and care for my garment?',
      'Compare les mesures de la fiche avec un vêtement que tu portes déjà. Pour l’entretien, utilise les consignes propres à l’article. Printful distingue notamment les vêtements imprimés, les pièces brodées et les casquettes.',
      'Compare the measurements on the product page with a garment you already wear. For care, follow the item-specific instructions. Printful distinguishes between printed garments, embroidered pieces and caps.',editorialLinks.care]
  ];
  return '<p class="editorial-lead">'+local(en,'Une question avant de passer commande ou après réception ? Voici comment ça se passe chez TSŪ.','Have a question before ordering or after delivery? Here is how it works at TSŪ.')+'</p>'+
    '<div class="faq-list">'+faqs.map(([fr,english,frAnswer,enAnswer,source])=>'<details><summary>'+local(en,fr,english)+'</summary><p>'+local(en,frAnswer,enAnswer)+
      '</p><p>'+externalEditorialLink(local(en,'Source et détails','Source and details'),source)+'</p></details>').join('')+'</div><p>'+
    navLink('/livraison-retours',en,'Voir la livraison et les retours','See shipping and returns')+' · '+
    navLink('/contact',en,'Contacter TSŪ','Contact TSŪ')+' · <a href="'+local(en,'/espace-client','/en/account')+'">'+
    local(en,'Ouvrir mon espace client','Open my account')+'</a></p>';
}

function mangaDate(value,en) {
  return new Intl.DateTimeFormat(en?'en-IE':'fr-BE',{day:'numeric',month:'long',timeZone:'UTC'}).format(new Date(value));
}
const journalImages = {
  watch: {path:'/journal-manga-anime.webp',fr:'Un manga ouvert, un calendrier et un écran de télévision illustrés dans le style TSŪ.',
    en:'An open manga, a calendar and a television illustrated in the TSŪ style.'},
  wardrobe: {path:'/journal-vestiaire-otaku.webp',fr:'Trois silhouettes streetwear avec un t-shirt clair, un sweat bleu et une surchemise.',
    en:'Three streetwear outfits with a light T-shirt, a blue hoodie and an overshirt.'}
};
const referenceCalendars = [
  ['Kana · Planning manga','https://www.kana.fr/planning/'],
  ['Pika Édition · Planning manga','https://www.pika.fr/planning-sorties/'],
  ['Glénat Manga · Planning','https://www.glenat.com/manga/planning-des-sorties/'],
  ['Manga-news · Sorties francophones','https://www.manga-news.com/index.php/planning'],
  ['Crunchyroll · Simulcasts','https://www.crunchyroll.com/fr/simulcasts']
];
const practicalJournal = new Set(['taille-t-shirt-oversize','entretien-t-shirt-imprime-brode']);
const staticArticleImage=article=>article.selection ? journalImages.watch : journalImages.wardrobe;
const editorialRevision='2026-11-24';

function journalFigure(image,en,priority=false) {
  return '<figure class="journal-figure"><img src="'+image.path+'" width="1200" height="800" alt="'+
    htmlEscape(local(en,image.fr,image.en))+'" decoding="async" '+(priority?'fetchpriority="high"':'loading="lazy"')+'>'+
    '<figcaption>'+local(en,'Illustration originale TSŪ','Original TSŪ illustration')+'</figcaption></figure>';
}
function journalCard(item,en) {
  return '<li><h3>'+navLink('/blog/'+item.slug,en,item.fr,item.en)+'</h3><p>'+
    htmlEscape(local(en,item.descFr,item.descEn))+'</p></li>';
}
function journalEditorial(en,editions) {
  const featured=journal.find(item=>item.selection);
  const style=journal.filter(item=>!item.selection&&!practicalJournal.has(item.slug));
  const guides=journal.filter(item=>practicalJournal.has(item.slug));
  const schedule=[...upcomingManga,...mangaSelection].sort((a,b)=>b.release.localeCompare(a.release));
  return '<p class="editorial-lead">'+local(en,'Qu’est-ce qui sort cette semaine ? Par quel manga commencer ? Le Journal TSŪ rassemble des dates sourcées, des conseils sans spoilers et des idées de tenues.',
    'What comes out this week? Which manga should you start with? The TSŪ journal brings together sourced dates, spoiler-free picks and outfit ideas.')+'</p>'+
    '<nav class="journal-topics" aria-label="'+local(en,'Rubriques du journal','Journal topics')+'">'+
    '<a href="#sorties-manga">'+local(en,'Sorties manga et anime','Manga and anime releases')+'</a>'+
    '<a href="#style-otaku">'+local(en,'Style et cosplay','Style and cosplay')+'</a>'+
    '<a href="#guides-vetements">'+local(en,'Tailles et entretien','Sizing and care')+'</a></nav>'+
    journalFigure(journalImages.watch,en,true)+
    '<section id="sorties-manga"><h2>'+local(en,'Sorties manga VF et agenda anime','French manga releases and anime schedule')+'</h2>'+
    (editions.length?editionList(editions.slice(0,3),en):'<p>'+local(en,'Retrouve ci-dessous les dernières dates relevées et les calendriers à consulter.','Find the latest dates we checked and the calendars to follow below.')+'</p>')+
    '<p>'+navLink('/blog/archives',en,'Consulter les archives de la veille','Browse release archives')+
    ' · <a href="'+journalFeedPath(en)+'">'+local(en,'Suivre le Journal par RSS','Follow the journal by RSS')+'</a></p>'+
    focusList(editions.slice(0,3),en)+
    '<ul class="journal-grid">'+journalCard(featured,en)+'</ul>'+
    '<h3>'+local(en,'Dates relevées en novembre et décembre 2026','Release dates checked for November and December 2026')+'</h3><p>'+
    local(en,'Vérifiées le 24 novembre 2026 auprès des éditeurs et des fiches de parution. Pour la Belgique, vérifie aussi la disponibilité chez ton libraire.',
      'Checked on 24 November 2026 against publisher and release listings. For Belgium, confirm availability with your bookseller.')+'</p><ul class="release-list">'+
    schedule.map(book=>'<li><time datetime="'+book.release+'">'+mangaDate(book.release,en)+'</time> · '+
      externalEditorialLink(book.title+' — '+local(en,book.editionFr,book.editionEn)+' ('+book.publisher+')',book.source)+'</li>').join('')+
    '</ul><p>'+local(en,'Kagurabachi est annoncé en anime pour avril 2027.','Kagurabachi is scheduled for an anime release in April 2027.')+' '+
    externalEditorialLink(local(en,'Annonce officielle de l’anime Kagurabachi','Official Kagurabachi anime announcement'),'https://anime.kagurabachi.jp/en/news/official-site-open/')+
    '</p><h3>'+local(en,'Calendriers à consulter','Calendars to follow')+'</h3>'+editorialSources(referenceCalendars,en)+'</section>'+
    '<section id="style-otaku"><h2>'+local(en,'Style otaku et cosplay casual','Otaku style and casual cosplay')+'</h2>'+
    journalFigure(journalImages.wardrobe,en)+'<ul class="journal-grid">'+style.map(item=>journalCard(item,en)).join('')+'</ul></section>'+
    '<section id="guides-vetements"><h2>'+local(en,'Guides tailles et entretien','Sizing and care guides')+'</h2>'+
    '<ul class="journal-grid">'+guides.map(item=>journalCard(item,en)).join('')+'</ul></section>';
}

function articleRelated(article,en) {
  const links=journal.filter(item=>item!==article && Boolean(item.selection)===Boolean(article.selection) &&
    practicalJournal.has(item.slug)===practicalJournal.has(article.slug)).slice(0,2);
  return '<aside class="journal-related"><h2>'+local(en,'À lire aussi','Related reading')+'</h2><ul class="release-list">'+
    links.map(item=>'<li>'+navLink('/blog/'+item.slug,en,item.fr,item.en)+'</li>').join('')+
    '<li>'+navLink('/blog',en,'Parcourir le Journal manga et anime','Browse the manga and anime journal')+'</li></ul></aside>';
}

function articleEditorial(article,en) {
  const intro = article.selection ? local(en,'Cinq choix éditoriaux, zéro spoiler. Chacun a une parution francophone ce mois-ci. Tu peux commencer au premier tome même si l’actualité concerne un volume plus avancé.',
    'Five editorial picks, zero spoilers. Each has a French-language release this month. Start with volume one even if the new release is a later volume.') : local(en,article.descFr,article.descEn);
  const body = article.selection ? mangaSelection.map(book=>
    '<section><h2>'+htmlEscape(book.title)+'</h2><p class="article-meta">'+htmlEscape(book.author)+' · '+htmlEscape(book.publisher)+'</p><p>'+htmlEscape(local(en,book.fr,book.en))+'</p><p>'+
    externalEditorialLink(local(en,'Fiche du ','Listing for ')+local(en,book.editionFr,book.editionEn)+' · '+mangaDate(book.release,en),book.source)+
    (book.stream?' · '+externalEditorialLink(local(en,'Fiche sur ','Listing on ')+book.streamTitle,book.stream):'')+
    (book.availability?' · '+externalEditorialLink(local(en,'Disponibilité en Belgique · JustWatch','Availability in Belgium · JustWatch'),book.availability):'')+'</p></section>').join('')+
    '<p>'+local(en,'Les liens de streaming indiquent les pages officielles. Le catalogue peut varier selon le pays.','Streaming links lead to official pages. Catalogues may vary by country.')+'</p>' :
    article.sections.map(([frTitle,enTitle,frBody,enBody])=>'<section><h2>'+htmlEscape(local(en,frTitle,enTitle))+'</h2><p>'+htmlEscape(local(en,frBody,enBody))+'</p></section>').join('')+
    '<h2>'+local(en,'Sources et repères','Sources and references')+'</h2>'+editorialSources(article.sources,en);
  return '<p class="article-meta">'+navLink('/blog',en,'Le journal TSŪ','The TSŪ journal')+' · <time datetime="2026-11-23">'+
    local(en,'23 novembre 2026','23 November 2026')+'</time> · '+local(en,'La rédaction TSŪ','TSŪ editorial team')+
    '</p><p class="editorial-lead">'+htmlEscape(intro)+'</p>'+
    journalFigure(staticArticleImage(article),en,true)+body+articleRelated(article,en)+
    '<p class="editorial-signature" lang="fr">Tu n’auras pas vu mon site pour rien.</p>';
}

function editorialPromo(en) {
  return '<aside id="tsu-promo" class="tsu-promo" hidden aria-labelledby="tsu-promo-title">'+
    '<p id="tsu-promo-title" class="tsu-promo-title">'+local(en,'Pause manga !','Manga break!')+'</p>'+
    '<button type="button" aria-label="'+local(en,'Fermer la fenêtre promotionnelle','Close promotion')+'">×</button>'+
    '<p>'+local(en,'Retrouve les sorties manga et anime dans le journal TSŪ.','Find the latest manga and anime in the TSŪ journal.')+'</p>'+
    '<a href="'+languagePath('/blog',en)+'">'+local(en,'Lire le journal','Read the journal')+'</a></aside>';
}

function editorialSponsor(env,en) {
  const url=safePhoto(env.TSU_SPONSOR_URL);
  const name=text(env.TSU_SPONSOR_NAME,110);
  if (!url || !name) return '';
  return '<aside class="tsu-sponsor"><p>'+local(en,'Annonce sponsorisée','Sponsored announcement')+'</p>'+
    '<a href="'+htmlEscape(url)+'" rel="sponsored noopener noreferrer">'+htmlEscape(name)+'</a></aside>';
}

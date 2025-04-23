const apiUrl = "https://api.allanime.day/api"
const baseUrl = "https://allanime.to"
const DEFAULT_HEADERS =  {
  "Content-Type": "application/json; charset=utf-8",
};
// GRAPHQL QUERIES
const SEARCH_QUERY = `
      query(
        $search: SearchInput,
        $limit: Int,
        $countryOrigin: VaildCountryOriginEnumType,
        $page: Int
      ) {
        shows(
          search: $search,
          limit: $limit,
          countryOrigin: $countryOrigin,
          page: $page
        ) {
          edges {
            _id
            name
            nativeName
            englishName
            thumbnail
            slugTime
          }
        }
      }
    `;
const DETAIL_EPISODE_QUERY = `
      query($id: String!) {
        show(_id: $id) {
          thumbnail
          description
          type
          season
          score
          genres
          status
          studios
          availableEpisodesDetail
        }
      }
    `;
const STREAM_QUERY =  `
query(
  $showId: String!
  $episodeString: String!
  $translationType: VaildTranslationTypeEnumType!
) {
  episode(
    showId: $showId
    episodeString: $episodeString
    translationType: $translationType
  ) {
    sourceUrls
  }
}
`;
async function searchResults(keyword) {
    try {

    const variable = {
      search: {
        query: keyword, 
        allowAdult: false,
        allowUnknown: false
      },
      countryOrigin: "ALL",
      limit: 26,
      page: 1
    };

    const response = await fetchv2(apiUrl, DEFAULT_HEADERS, "POST",{ query:SEARCH_QUERY.replace(/\n/g, ''),variables: variable })
        const data = await response.json();
        const resList = data.data.shows.edges    
        const transformedResults = resList.map(anime => ({
            title: anime.englishName,
            image: anime.thumbnail,
            href: anime._id
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
        return JSON.stringify([{ title: 'Error', image: '', href: '' }]);
    }
}

async function extractDetails(id) {
    try {


    const variable = {id:id}
    const response = await fetchv2(`${apiUrl}`, DEFAULT_HEADERS, "POST",({ query:DETAIL_EPISODE_QUERY.replace(/\n/g, ''),variables: variable }))
        const data = await response.json();
        const anime = data.data.show
        const transformedResults = {
            description: htmlToText(anime.description).replace(/\n+/g, '')|| 'No description available',
            aliases: `Duration: ${'Unknown'}`,
            airdate: `Aired: ${anime.season.year || 'Unknown'}`
        };
        
        return JSON.stringify(transformedResults);
    } catch (error) {
        console.log('Details error:', error);
        return JSON.stringify([{
        description: 'Error loading description',
        aliases: 'Duration: Unknown',
        airdate: 'Aired: Unknown'
        }]);
  }
}

async function extractEpisodes(id) {
    try {


    const variable = {id:id}
    const response = await fetchv2(`${apiUrl}`, DEFAULT_HEADERS, "POST",({ query:DETAIL_EPISODE_QUERY.replace(/\n/g, ''),variables: variable }))
        const data = await response.json();
        const anime = data.data.show
        console.log(anime)
        const transformedResults = anime.availableEpisodesDetail.sub.map((episode,idx) => ({
            href: JSON.stringify({showId:id,translationType:"sub",episodeString:episode}),
            number: parseInt(episode, 10) || 1
        }));
        
        return JSON.stringify(transformedResults);
        
    } catch (error) {
        console.log('Fetch error:', error);
    }    
}

async function extractStreamUrl(url) {
    try {
        const variable = JSON.parse(url)
        const response = await fetchv2(`${apiUrl}`, DEFAULT_HEADERS, "POST",({ query:STREAM_QUERY.replace(/\n/g, ''),variables: variable }))

        const data = await response.json();
       const mp4Val = data.data.episode.sourceUrls.filter(x=> x.sourceName == "Mp4")
       if(mp4Val)
        {
          const streamUrl = await mp4Extractor(mp4Val[0].sourceUrl)
          return streamUrl == ""? null:streamUrl
        }
        return null
    } catch (error) {
       console.log('Fetch error:', error);
       return null;
    }
}

//util functions
function htmlToText(htmlText)
{
    let text = htmlText.replace(/<br\s*\/?>/gi, '\n');
// Decode HTML entities
  const entities = {
    '&amp;': '&',
    '&lt;': '<',
    '&gt;': '>',
    '&quot;': '"',
    '&apos;': "'",
    '&#x2014;': '—',
    '&#x2019;': '’',
    '&#x201c;': '“',
    '&#x201d;': '”',
    // Add more as needed
  };
  text = text.replace(/&#x[0-9a-fA-F]+;|&[a-z]+;/g, match => {
    if (entities[match]) return entities[match];

    // Handle numeric hex entities like &#x2014;
    if (/^&#x/.test(match)) {
      const code = parseInt(match.replace(/[&#x;]/g, ''), 16);
      return String.fromCharCode(code);
    }

    return match; // Unknown entity, leave as is
  });

  // Optionally remove any other HTML tags
  text = text.replace(/<[^>]*>/g, '');

  return text;
}
// extract URL based on sources
// MP4 EXTRACTOR
async function mp4Extractor(url) {
  const Referer = "https://mp4upload.com"
  const headers = {"Referer":Referer}
  const response = await fetchv2(url,headers)
  const htmlText = await response.text()
  const streamUrl = extractMp4Script(htmlText)
  return streamUrl
}
function extractMp4Script(htmlText)
{
  const scripts = extractScriptTags(htmlText);
  let scriptContent = null;


  scriptContent = scripts.find(script =>
      script.includes('eval')
  );

  scriptContent = scripts.find(script => script.includes('player.src'));

  return scriptContent
  .split(".src(")[1]
  .split(")")[0]
  .split("src:")[1]
  .split('"')[1] || '';
}
// Extract all <script>...</script> blocks
function extractScriptTags(html) {
  const scriptRegex = /<script[^>]*>([\s\S]*?)<\/script>/gi;
  const scripts = [];
  let match;

  while ((match = scriptRegex.exec(html)) !== null) {
      scripts.push(match[1].trim());
  }

  return scripts;
}


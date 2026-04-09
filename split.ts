// Author: Jingnan
// Fetches road segments within a polygon from the OpenStreetMap API.
// Ways are split at junction nodes to produce individual drivable segments.

type Coorditate = [lat: number, lon: number];

interface RoadSegment {
  wayId: number;
  name: string | null;
  highway: string;
  segmentIndex: number;
  nodes: Coorditate[];
}

interface OsmNode {
  type: "node";
  id: number;
  lat: number;
  lon: number;
  tags?: Record<string, string>;
}
interface OsmWay {
  type: "way";
  id: number;
  nodes: number[];
  tags?: Record<string, string>;
}
type OsmElement = OsmNode | OsmWay | { type: "relation" };

interface OsmApiResponse {
  elements: OsmElement[];
}

// First, check validation of input
function pointInPolygon(point: Coorditate, polygon: Coorditate[]): boolean {
  const [lat, lon] = point;
  let inside = false;

  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [latI, lonI] = polygon[i];
    const [latJ, lonJ] = polygon[j];

    if ((latI > lat) !== (latJ > lat)) {
      const lonCross = lonI + ((lat - latI) / (latJ - latI)) * (lonJ - lonI);
      if (lon < lonCross) inside = !inside;
    }
  }

  return inside;
}


async function getRoadSegments(polygon: Coorditate[]): Promise<RoadSegment[]> {
  const lats = polygon.map(([lat]) => lat);
  const lons = polygon.map(([, lon]) => lon);
//  Secondly, put the pylogin in a box because OSM API only accepts a bounding box
  const bbox = [
    Math.min(...lons), // left   – minLon
    Math.min(...lats), // bottom – minLat
    Math.max(...lons), // right  – maxLon
    Math.max(...lats), // top    – maxLat
  ].join(",");

// Then, get response from OSM API
  const url = `https://api.openstreetmap.org/api/0.6/map?bbox=${bbox}`;
  const response = await fetch(url, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    throw new Error(
      `OSM API returned HTTP ${response.status}: ${await response.text()}`
    );
  }
  const data: OsmApiResponse = await response.json();

//  And then, seperate the data into nodes and ways, and build a map of node IDs to their coordinates for easy lookup when processing the ways.
  const nodeCoorditates = new Map<number, Coorditate>();
  // Now I understand why you said the response it large, I did not know that the response include both node and ways.
  for (const roadData of data.elements) {
    if (roadData.type === "node") {
      const { id, lat, lon } = roadData as OsmNode;
      nodeCoorditates.set(id, [lat, lon]);
    }
  }

  const ways = (data.elements as OsmElement[]).filter(
    (roadData): roadData is OsmWay =>
      roadData.type === "way" && (roadData as OsmWay).tags?.highway !== undefined
  );

  const seenInWay = new Set<number>();
  const junctionNodes = new Set<number>();
  for (const way of ways) {
    for (const nodeId of way.nodes) {
      if (seenInWay.has(nodeId)) junctionNodes.add(nodeId);
      else seenInWay.add(nodeId);
    }
  }

  const segments: RoadSegment[] = [];
// and the end, segment the ways into segments based on junction nodes and way endpoints. Each segment is represented as a RoadSegment object containing the way ID, name, highway type, segment index, and an array of node coordinates. The function returns an array of these segments that fall within the specified polygon.
  for (const way of ways) {
    const name = way.tags?.name ?? null;
    const highway = way.tags!.highway;

    let currentSegment: Coorditate[] = [];
    let segmentIndex = 0;

    for (let i = 0; i < way.nodes.length; i++) {
      const nodeId = way.nodes[i];
      const Coorditate = nodeCoorditates.get(nodeId);
      if (Coorditate === undefined) continue;

      currentSegment.push(Coorditate);

      const isLastNode = i === way.nodes.length - 1;
      const isJunction = junctionNodes.has(nodeId);

      if (currentSegment.length >= 2 && (isJunction || isLastNode)) {
        segments.push({
          wayId: way.id,
          name,
          highway,
          segmentIndex,
          nodes: [...currentSegment],
        });
        segmentIndex++;
        currentSegment = [Coorditate];
      }
    }
  }

  return segments;
}

// sample data here
const stockholmBlock: Coorditate[] = [
  [59.330, 18.065],
  [59.335, 18.065],
  [59.335, 18.075],
  [59.330, 18.075],
];

getRoadSegments(stockholmBlock)
  .then((segs) => {
    console.log(JSON.stringify(segs, null, 2));
    console.log(`\nTotal segments: ${segs.length}`);
  })
  .catch(console.error);
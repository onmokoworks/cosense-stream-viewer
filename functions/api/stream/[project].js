export async function onRequestGet(context) {
  const project = context.params.project;

  if (!project || project.includes("/")) {
    return Response.json({ error: "Invalid project name" }, { status: 400 });
  }

  try {
    const apiUrl = `https://scrapbox.io/api/stream/${encodeURIComponent(project)}`;
    const res = await fetch(apiUrl);

    if (!res.ok) {
      return Response.json(
        { error: `Scrapbox API returned ${res.status}` },
        { status: res.status }
      );
    }

    const data = await res.json();
    return Response.json(data, {
      headers: { "Cache-Control": "public, max-age=60" },
    });
  } catch (err) {
    return Response.json({ error: err.message }, { status: 500 });
  }
}

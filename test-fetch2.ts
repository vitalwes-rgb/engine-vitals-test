import fetch from "node-fetch";

async function run() {
  const res = await fetch("http://localhost:3000/api/analyze", {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify({
      vehicle: { year: 2005, make: "Ford", model: "F-150" },
      scanData: null
    })
  });
  console.log(res.status, await res.text());
}
run();

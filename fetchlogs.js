const https = require('https');
https.get('https://api.github.com/repos/owaisarahmani-beep/Pixora/actions/runs', { headers: { 'User-Agent': 'node' } }, res => {
  let data = '';
  res.on('data', chunk => data += chunk);
  res.on('end', () => {
    const runs = JSON.parse(data).workflow_runs;
    const runId = runs[0].id;
    https.get(`https://api.github.com/repos/owaisarahmani-beep/Pixora/actions/runs/${runId}/jobs`, { headers: { 'User-Agent': 'node' } }, res2 => {
      let data2 = '';
      res2.on('data', chunk => data2 += chunk);
      res2.on('end', () => {
        const jobs = JSON.parse(data2).jobs;
        const jobLogUrl = `https://api.github.com/repos/owaisarahmani-beep/Pixora/actions/jobs/${jobs[0].id}/logs`;
        https.get(jobLogUrl, { headers: { 'User-Agent': 'node', 'Accept': 'application/vnd.github.v3+json' } }, res3 => {
          if(res3.statusCode === 302) {
             https.get(res3.headers.location, { headers: { 'User-Agent': 'node' } }, res4 => {
                 let data4 = '';
                 res4.on('data', chunk => data4 += chunk);
                 res4.on('end', () => console.log(data4.slice(-2000)));
             });
          } else {
             console.log("No logs", res3.statusCode);
          }
        });
      });
    });
  });
});

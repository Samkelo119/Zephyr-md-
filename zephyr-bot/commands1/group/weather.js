const axios = require('axios');

module.exports = {
  name: 'weather',
  category: 'Utility',
  description: '.weather <city> — get current conditions for a city.',
  async run({ sock, jid, args, msg }) {
    const city = args.join(' ').trim();
    if (!city) {
      await sock.sendMessage(jid, { text: 'Usage: .weather <city name>' }, { quoted: msg });
      return;
    }

    try {
      const { data } = await axios.get(
        `https://wttr.in/${encodeURIComponent(city)}?format=j1`,
        { timeout: 10000 }
      );
      const current = data.current_condition?.[0];
      const areaName = data.nearest_area?.[0]?.areaName?.[0]?.value || city;

      if (!current) throw new Error('No data returned');

      const text =
        `*Weather in ${areaName}*\n` +
        `Condition: ${current.weatherDesc?.[0]?.value}\n` +
        `Temperature: ${current.temp_C}°C (feels like ${current.FeelsLikeC}°C)\n` +
        `Humidity: ${current.humidity}%\n` +
        `Wind: ${current.windspeedKmph} km/h`;

      await sock.sendMessage(jid, { text }, { quoted: msg });
    } catch (err) {
      await sock.sendMessage(
        jid,
        { text: `Couldn't fetch weather for "${city}". Check the spelling and try again.` },
        { quoted: msg }
      );
    }
  },
};
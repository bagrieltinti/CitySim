const block = (start, end, activity, place, category) => ({ start, end, activity, place, category });

export function buildRoutine(person) {
  const days = {};
  const caringForYoungChildren = Number(person.youngDependentCount || 0) > 0;
  for (let day = 0; day < 7; day++) {
    let schedule = [];
    if (person.age < 6 && person.childcare?.status === "vaga ativa" && day < 5) {
      const daycare = person.childcare.providerName || "Creche Municipal Sementinha";
      schedule = [
        block(0, 360, "Dormindo", "home", "rest"),
        block(360, 420, "Café da manhã com responsáveis", "home", "meal"),
        block(420, 480, "Indo à creche com responsável", daycare, "commute"),
        block(480, 720, "Brincadeiras e desenvolvimento na creche", daycare, "study"),
        block(720, 780, "Almoço na creche", daycare, "meal"),
        block(780, 1020, "Atividades e descanso na creche", daycare, "leisure"),
        block(1020, 1080, "Voltando da creche com responsável", "home", "commute"),
      ];
    } else if (person.education?.enrolled && day < 5) {
      schedule = [
        block(0, 360, "Dormindo", "home", "rest"),
        block(360, 420, "Café da manhã", "home", "meal"),
        block(420, 480, "Indo para a aula", person.education.institution, "commute"),
        block(480, 720, "Estudando", person.education.institution, "study"),
        block(720, 780, "Almoçando", person.education.institution, "meal"),
        block(780, 960, "Estudando", person.education.institution, "study"),
        block(960, 1020, "Voltando para casa", "home", "commute"),
      ];
    } else if (person.lifeCourse?.retirement?.active || person.age >= 65) {
      const needsCare = Number(person.lifeCourse?.careNeed || 0) >= 55;
      schedule = [
        block(0, 420, "Dormindo", "home", "rest"),
        block(420, 480, "Café da manhã e medicação", "home", "meal"),
        block(480, 600, needsCare ? "Recebendo cuidado e acompanhamento" : "Caminhada matinal", needsCare ? "home" : "park", needsCare ? "care" : "leisure"),
        block(600, 720, day < 5 ? "Convivendo e participando de atividade para idosos" : "Visitando familiares", day < 5 ? "Centro de Convivência do Idoso" : "social", "social"),
        block(720, 810, "Almoçando", "home", "meal"),
        block(810, 960, "Descanso da tarde", "home", "rest"),
        block(960, 1080, needsCare ? "Consulta, fisioterapia ou cuidado domiciliar" : "Cuidando de assuntos pessoais", needsCare ? "health" : "Centro", needsCare ? "care" : "errand"),
      ];
    } else if (person.shift?.days.includes(day)) {
      const start = person.shift.start * 60;
      const end = person.shift.end <= person.shift.start ? 1440 : person.shift.end * 60;
      if (start >= 360) {
        const departure = Math.max(285, start - 75);
        const wake = Math.max(240, departure - 60);
        schedule = [
          block(0, wake, "Dormindo", "home", "rest"),
          block(wake, departure, "Café da manhã", "home", "meal"),
          block(departure, start, "Indo ao trabalho", person.workplace, "commute"),
          block(start, Math.min(end, start + 240), `Trabalhando como ${person.role.toLowerCase()}`, person.workplace, "work"),
          block(Math.min(end, start + 240), Math.min(end, start + 285), "Pausa para refeição", person.workplace, "meal"),
          block(Math.min(end, start + 285), end, `Trabalhando como ${person.role.toLowerCase()}`, person.workplace, "work"),
        ];
      } else {
        schedule = [
          block(0, end, `Trabalhando como ${person.role.toLowerCase()}`, person.workplace, "work"),
          block(end, end + 60, "Voltando para casa", "home", "commute"),
          block(end + 60, 840, "Dormindo", "home", "rest"),
          block(840, 960, "Cuidando de assuntos pessoais", "Centro", "errand"),
          block(960, 1080, "Tempo livre", "home", "leisure"),
          block(1080, 1260, "Descansando antes do turno", "home", "rest"),
          block(1260, 1320, "Jantando", "home", "meal"),
          block(1320, 1440, `Trabalhando como ${person.role.toLowerCase()}`, person.workplace, "work"),
        ];
      }
    } else if (person.age < 6) {
      schedule = [
        block(0, 420, "Dormindo", "home", "rest"),
        block(420, 480, "Café da manhã com responsáveis", "home", "meal"),
        block(480, 1020, "Brincando sob cuidados da família", "home", "leisure"),
      ];
    } else if (person.age < 12) {
      schedule = [
        block(0, 450, "Dormindo", "home", "rest"),
        block(450, 510, "Café da manhã com a família", "home", "meal"),
        block(510, 720, day > 4 ? "Brincando no parque com responsáveis" : "Lendo e fazendo atividades escolares", day > 4 ? "park" : "home", day > 4 ? "social" : "study"),
        block(720, 810, "Almoçando com a família", "home", "meal"),
        block(810, 1050, "Brincando com amigos", day > 4 ? "park" : "social", "social"),
      ];
    } else if (person.age < 18) {
      schedule = [
        block(0, 480, "Dormindo", "home", "rest"),
        block(480, 540, "Café da manhã", "home", "meal"),
        block(540, 720, day > 4 ? "Praticando esporte e encontrando amigos" : "Estudando e fazendo trabalhos", day > 4 ? "park" : "home", day > 4 ? "social" : "study"),
        block(720, 810, "Almoçando", "home", "meal"),
        block(810, 1080, day === 5 ? "Passeando com amigos" : "Curso, hobby ou tempo livre", day === 5 ? "social" : "home", day === 5 ? "social" : "leisure"),
      ];
    } else {
      schedule = [
        block(0, 420, "Dormindo", "home", "rest"),
        block(420, 480, "Café da manhã", "home", "meal"),
        block(480, 660, "Cuidando de assuntos pessoais", "Centro", "errand"),
        block(660, 780, "Almoçando", "home", "meal"),
        block(780, 1020, day > 4 ? "Passeando" : "Realizando tarefas domésticas", day > 4 ? "park" : "home", "leisure"),
      ];
    }

    const last = Math.max(1020, ...schedule.map((item) => item.end));
    if (person.age < 6) {
      if (last < 1200) schedule.push(block(last, 1200, "Brincando com a família", "home", "social"));
      if (last < 1260) schedule.push(block(Math.max(last, 1200), 1260, "Jantando com responsáveis", "home", "meal"));
      if (last < 1440) schedule.push(block(Math.max(last, 1260), 1440, "Dormindo", "home", "rest"));
    } else if (person.age < 12) {
      if (last < 1170) schedule.push(block(last, 1170, "Tempo com a família", "home", "social"));
      if (last < 1230) schedule.push(block(Math.max(last, 1170), 1230, "Jantando com responsáveis", "home", "meal"));
      if (last < 1440) schedule.push(block(Math.max(last, 1230), 1440, "Dormindo", "home", "rest"));
    } else if (person.age < 18) {
      if (last < 1200) schedule.push(block(last, 1200, day === 5 ? "Encontrando amigos" : "Conversando com amigos e família", day === 5 ? "social" : "home", "social"));
      if (last < 1260) schedule.push(block(Math.max(last, 1200), 1260, "Jantando", "home", "meal"));
      if (last < 1350) schedule.push(block(Math.max(last, 1260), 1350, "Lazer em casa", "home", "leisure"));
      if (last < 1440) schedule.push(block(Math.max(last, 1350), 1440, "Dormindo", "home", "rest"));
    } else if (person.lifeCourse?.retirement?.active || person.age >= 65) {
      if (last < 1170) schedule.push(block(last, 1170, "Conversando com familiares e vizinhos", "home", "social"));
      if (last < 1230) schedule.push(block(Math.max(last, 1170), 1230, "Jantando e tomando medicação", "home", "meal"));
      if (last < 1320) schedule.push(block(Math.max(last, 1230), 1320, "Lazer tranquilo", "home", "leisure"));
      if (last < 1440) schedule.push(block(Math.max(last, 1320), 1440, "Dormindo", "home", "rest"));
    } else {
      const eveningPlace = !caringForYoungChildren && (person.traits?.includes("sociável") || day === 5) ? "social" : "home";
      if (last < 1140) schedule.push(block(last, 1140, "Fazendo compras", "shop", "errand"));
      if (last < 1260) schedule.push(block(Math.max(last, 1140), 1260, caringForYoungChildren ? "Cuidando das crianças e da rotina da casa" : eveningPlace === "social" ? "Encontrando amigos" : "Tempo com a família", eveningPlace, caringForYoungChildren ? "care" : "social"));
      if (last < 1350) schedule.push(block(Math.max(last, 1260), 1350, caringForYoungChildren ? "Jantando com as crianças" : "Jantando", "home", "meal"));
      if (last < 1440) schedule.push(block(Math.max(last, 1350), 1440, "Descansando", "home", "rest"));
    }
    days[day] = schedule.filter((item) => item.end > item.start).sort((a, b) => a.start - b.start);
  }
  return days;
}

export function currentBlock(person, day, minute) {
  const schedule = person.routine?.[day] || [];
  return schedule.find((item) => minute >= item.start && minute < item.end) || { activity: "Tempo livre", place: "home", category: "leisure" };
}

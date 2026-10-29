const { workingDays, spreadVisits } = require("../src/services/planDates");

// Builds the demo field-work data for one company: reps, doctors, assignments and the visits of
// last month and this month. Pure and seeded, so the same company always gets the same data.
const REP_NAMES = [
  ["Aarav", "Shah"], ["Priya", "Nair"], ["Rohit", "Verma"],
  ["Sneha", "Kulkarni"], ["Vikram", "Patil"], ["Neha", "Joshi"],
];
const DOCTOR_NAMES = [
  "Dr. Anil Mehta", "Dr. Kavita Rao", "Dr. Sameer Khan", "Dr. Pooja Desai", "Dr. Rahul Iyer",
  "Dr. Meera Kapoor", "Dr. Suresh Gupta", "Dr. Anjali Menon", "Dr. Farah Sheikh",
  "Dr. Nitin Jain", "Dr. Ritu Bhatia", "Dr. Manoj Pillai", "Dr. Leena Dsouza",
  "Dr. Harish Reddy", "Dr. Swati Kulkarni", "Dr. Deepak Sinha",
];
const CITIES = [
  { city: "Pune", latitude: 18.5204, longitude: 73.8567 },
  { city: "Mumbai", latitude: 19.076, longitude: 72.8777 },
];
// Share of past visits each rep completes: one strong, one average, one weak rep.
const REP_PERFORMANCE = [0.92, 0.72, 0.45];
// The weak rep skips this doctor all of this month, so "not visited" has a row.
const NEGLECTED_DOCTOR = 5;
const REPS_PER_COMPANY = 3;
const DOCTORS_PER_COMPANY = 8;

// Small deterministic random generator (Park-Miller), returns numbers in [0, 1).
const MODULUS = 2147483647;
function seededRandom(seed) {
  let state = (Math.abs(seed) % (MODULUS - 1)) + 1;
  return () => {
    state = (state * 48271) % MODULUS;
    return (state - 1) / (MODULUS - 1);
  };
}

function previousMonth(month) {
  const [year, mon] = month.split("-").map(Number);
  const date = new Date(Date.UTC(year, mon - 2, 1));
  return date.toISOString().slice(0, 7);
}

function pick(list, offset, count) {
  return Array.from({ length: count }, (_, i) => list[(offset + i) % list.length]);
}

function buildPeople(index) {
  const place = CITIES[index % CITIES.length];
  const reps = pick(REP_NAMES, index * REPS_PER_COMPANY, REPS_PER_COMPANY)
    .map(([firstName, lastName], i) => ({ key: i, firstName, lastName }));
  const doctors = pick(DOCTOR_NAMES, index * DOCTORS_PER_COMPANY, DOCTORS_PER_COMPANY)
    .map((name, i) => ({
      key: i,
      name,
      city: place.city,
      latitude: Number((place.latitude + (i - 4) * 0.01).toFixed(7)),
      longitude: Number((place.longitude + (i % 3) * 0.01).toFixed(7)),
    }));
  const assignments = doctors.map((doctor) => ({
    doctor: doctor.key,
    rep: doctor.key % REPS_PER_COMPANY,
    visitsPerMonth: 2 + (doctor.key % 3),
  }));
  return { reps, doctors, assignments };
}

function visitStatus(date, today, performance, random) {
  if (date >= today) return { status: "Pending", review: null };
  if (random() >= performance) return { status: "Missed", review: null };
  const roll = random();
  let review = "Approved";
  if (roll >= 0.85) review = "Rejected";
  else if (roll >= 0.7) review = "Pending";
  return { status: "Completed", review };
}

function buildVisits(assignments, today, random) {
  const thisMonth = today.slice(0, 7);
  const visits = [];
  [previousMonth(thisMonth), thisMonth].forEach((month) => {
    const days = workingDays(month, "1970-01-01");
    for (let rep = 0; rep < REPS_PER_COMPANY; rep += 1) {
      const mine = assignments.filter((a) => a.rep === rep);
      const needs = mine.map((a) => ({ key: a.doctor, count: a.visitsPerMonth }));
      spreadVisits(days, needs).forEach((dates, doctor) => {
        const skipped = month === thisMonth && doctor === NEGLECTED_DOCTOR;
        const performance = skipped ? 0 : REP_PERFORMANCE[rep];
        dates.forEach((date) => visits.push({
          rep, doctor, month, date, ...visitStatus(date, today, performance, random),
        }));
      });
    }
  });
  return visits;
}

// index: position of the company in the run (picks different names); today: "YYYY-MM-DD".
function buildDemoPlan({ companyId, index, today }) {
  const people = buildPeople(index);
  const random = seededRandom(companyId * 7919);
  return { ...people, visits: buildVisits(people.assignments, today, random) };
}

module.exports = { buildDemoPlan, previousMonth, seededRandom };

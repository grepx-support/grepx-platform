/*
 * Copyright (c) 2026 GrepX Private Limited (grepx.sg). All rights reserved.
 * This file is part of the GrepX platform and is proprietary and confidential.
 * Unauthorised copying, use, modification or distribution is strictly prohibited.
 */

// Team: people across the places (team/list, team/person), the roster (team/roster), leave (team/leave), payroll (team/payroll, pay-settings, payslip), clock in / out (team/clock).
import { clockPage } from "./team/clock.js";
import { leavePage } from "./team/leave.js";
import { paySettingsPage } from "./team/pay-settings.js";
import { payrollPage } from "./team/payroll.js";
import { teamPage } from "./team/list.js";
import { personPage } from "./team/person.js";
import { rosterPage } from "./team/roster.js";

const boss = { area: "team", auth: "staff", tenant: true, perm: ["manage_people", "manage_business"] };
export const routes = [
  { ...boss, path: "/team", feature: "team", nav: "Team", key: "t", icon: "users", group: "People", render: teamPage, keywords: "employees staff people hr documents licence" },
  { ...boss, path: "/team/person", feature: "team", render: personPage, keywords: "employee profile" },
  { ...boss, path: "/roster", feature: "roster", nav: "Roster", icon: "calendar", group: "People", render: rosterPage, keywords: "roster shifts schedule week rota" },
  { ...boss, path: "/leave", feature: "leave", nav: "Leave", icon: "inbox", group: "People", render: leavePage, keywords: "leave holiday vacation sick absence approve balance" },
  { ...boss, perm: "manage_business", path: "/payroll", nav: "Payroll", icon: "coin", group: "People", render: payrollPage, keywords: "payroll salary wages payslip pf esi cpf super tax" },
  { ...boss, perm: "manage_business", path: "/payroll/settings", render: paySettingsPage, keywords: "payroll country tax rates pf esi cpf super payg tds settings" },
  { path: "/clock", feature: "roster", nav: "Clock in / out", icon: "clock", group: "People", area: "team", auth: "staff", tenant: true, render: clockPage, keywords: "clock in out attendance pin" },
];

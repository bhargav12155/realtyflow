"use strict";
/**
 * Admin routes for managing user credits and billing.
 *
 * GET  /api/admin/billing/wallet/:userId — view user's wallet and recent ledger
 * POST /api/admin/billing/topup — add credits to user account
 * GET  /api/admin/billing/usage — view recent AI usage events
 */
var __awaiter = (this && this.__awaiter) || function (thisArg, _arguments, P, generator) {
    function adopt(value) { return value instanceof P ? value : new P(function (resolve) { resolve(value); }); }
    return new (P || (P = Promise))(function (resolve, reject) {
        function fulfilled(value) { try { step(generator.next(value)); } catch (e) { reject(e); } }
        function rejected(value) { try { step(generator["throw"](value)); } catch (e) { reject(e); } }
        function step(result) { result.done ? resolve(result.value) : adopt(result.value).then(fulfilled, rejected); }
        step((generator = generator.apply(thisArg, _arguments || [])).next());
    });
};
var __generator = (this && this.__generator) || function (thisArg, body) {
    var _ = { label: 0, sent: function() { if (t[0] & 1) throw t[1]; return t[1]; }, trys: [], ops: [] }, f, y, t, g = Object.create((typeof Iterator === "function" ? Iterator : Object).prototype);
    return g.next = verb(0), g["throw"] = verb(1), g["return"] = verb(2), typeof Symbol === "function" && (g[Symbol.iterator] = function() { return this; }), g;
    function verb(n) { return function (v) { return step([n, v]); }; }
    function step(op) {
        if (f) throw new TypeError("Generator is already executing.");
        while (g && (g = 0, op[0] && (_ = 0)), _) try {
            if (f = 1, y && (t = op[0] & 2 ? y["return"] : op[0] ? y["throw"] || ((t = y["return"]) && t.call(y), 0) : y.next) && !(t = t.call(y, op[1])).done) return t;
            if (y = 0, t) op = [op[0] & 2, t.value];
            switch (op[0]) {
                case 0: case 1: t = op; break;
                case 4: _.label++; return { value: op[1], done: false };
                case 5: _.label++; y = op[1]; op = [0]; continue;
                case 7: op = _.ops.pop(); _.trys.pop(); continue;
                default:
                    if (!(t = _.trys, t = t.length > 0 && t[t.length - 1]) && (op[0] === 6 || op[0] === 2)) { _ = 0; continue; }
                    if (op[0] === 3 && (!t || (op[1] > t[0] && op[1] < t[3]))) { _.label = op[1]; break; }
                    if (op[0] === 6 && _.label < t[1]) { _.label = t[1]; t = op; break; }
                    if (t && _.label < t[2]) { _.label = t[2]; _.ops.push(op); break; }
                    if (t[2]) _.ops.pop();
                    _.trys.pop(); continue;
            }
            op = body.call(thisArg, _);
        } catch (e) { op = [6, e]; y = 0; } finally { f = t = 0; }
        if (op[0] & 5) throw op[1]; return { value: op[0] ? op[1] : void 0, done: true };
    }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.registerAdminBillingRoutes = registerAdminBillingRoutes;
var zod_1 = require("zod");
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("../db");
var schema_1 = require("@shared/schema");
var topupSchema = zod_1.z.object({
    userId: zod_1.z.string().min(1),
    amountCredits: zod_1.z.number().int().min(1).max(100000),
    reason: zod_1.z.string().min(1).max(200),
});
function registerAdminBillingRoutes(app, deps) {
    var _this = this;
    var storage = deps.storage, requireAdmin = deps.requireAdmin;
    // GET /api/admin/billing/wallet/:userId
    // View user's wallet balance and recent ledger entries
    app.get("/api/admin/billing/wallet/:userId", requireAdmin, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var userId, wallet, ledgerEntries, error_1;
        return __generator(this, function (_a) {
            switch (_a.label) {
                case 0:
                    _a.trys.push([0, 3, , 4]);
                    userId = req.params.userId;
                    return [4 /*yield*/, storage.getWalletAccount(userId)];
                case 1:
                    wallet = _a.sent();
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.walletLedger)
                            .where((0, drizzle_orm_1.eq)(schema_1.walletLedger.userId, userId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.walletLedger.createdAt))
                            .limit(50)];
                case 2:
                    ledgerEntries = _a.sent();
                    return [2 /*return*/, res.json({
                            wallet: wallet,
                            recentLedger: ledgerEntries,
                        })];
                case 3:
                    error_1 = _a.sent();
                    console.error("[admin-billing] GET wallet failed:", error_1);
                    return [2 /*return*/, res.status(500).json({ error: "Failed to load wallet" })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    // POST /api/admin/billing/topup
    // Add credits to a user's account
    app.post("/api/admin/billing/topup", requireAdmin, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var parsed, _a, userId, amountCredits, reason, adminId, result, error_2;
        var _b, _c;
        return __generator(this, function (_d) {
            switch (_d.label) {
                case 0:
                    parsed = topupSchema.safeParse(req.body);
                    if (!parsed.success) {
                        return [2 /*return*/, res.status(400).json({
                                error: "Invalid request",
                                issues: parsed.error.issues.map(function (i) { return ({
                                    path: i.path.join("."),
                                    message: i.message,
                                }); }),
                            })];
                    }
                    _a = parsed.data, userId = _a.userId, amountCredits = _a.amountCredits, reason = _a.reason;
                    adminId = String((_c = (_b = req.user) === null || _b === void 0 ? void 0 : _b.id) !== null && _c !== void 0 ? _c : "admin");
                    _d.label = 1;
                case 1:
                    _d.trys.push([1, 3, , 4]);
                    return [4 /*yield*/, storage.creditWalletCredits(userId, amountCredits, "admin_topup_".concat(reason), {
                            requestId: "admin_".concat(Date.now()),
                            metadata: {
                                adminId: adminId,
                                reason: reason,
                            },
                        })];
                case 2:
                    result = _d.sent();
                    return [2 /*return*/, res.json({
                            success: true,
                            userId: userId,
                            creditsAdded: amountCredits,
                            newBalance: result.balance,
                            reason: reason,
                        })];
                case 3:
                    error_2 = _d.sent();
                    console.error("[admin-billing] topup failed:", error_2);
                    return [2 /*return*/, res.status(500).json({ error: "Failed to add credits" })];
                case 4: return [2 /*return*/];
            }
        });
    }); });
    // GET /api/admin/billing/usage
    // View recent AI usage events
    app.get("/api/admin/billing/usage", requireAdmin, function (req, res) { return __awaiter(_this, void 0, void 0, function () {
        var limit, events, summary, _i, events_1, e, error_3;
        var _a;
        return __generator(this, function (_b) {
            switch (_b.label) {
                case 0:
                    _b.trys.push([0, 2, , 3]);
                    limit = Math.min(parseInt(req.query.limit, 10) || 100, 1000);
                    return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.aiUsageEvents)
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.aiUsageEvents.createdAt))
                            .limit(limit)];
                case 1:
                    events = _b.sent();
                    summary = {
                        totalEvents: events.length,
                        byStatus: {
                            charged: events.filter(function (e) { return e.status === "charged"; }).length,
                            refunded: events.filter(function (e) { return e.status === "refunded"; }).length,
                            blocked: events.filter(function (e) { return e.status === "blocked"; }).length,
                        },
                        byProvider: {},
                        totalChargedCredits: 0,
                        totalRefundedCredits: 0,
                    };
                    for (_i = 0, events_1 = events; _i < events_1.length; _i++) {
                        e = events_1[_i];
                        summary.byProvider[e.provider] = ((_a = summary.byProvider[e.provider]) !== null && _a !== void 0 ? _a : 0) + 1;
                        if (e.status === "charged" && e.actualCredits) {
                            summary.totalChargedCredits += e.actualCredits;
                        }
                        if (e.status === "refunded" && e.actualCredits) {
                            summary.totalRefundedCredits += Math.abs(e.actualCredits);
                        }
                    }
                    return [2 /*return*/, res.json({
                            summary: summary,
                            events: events,
                        })];
                case 2:
                    error_3 = _b.sent();
                    console.error("[admin-billing] GET usage failed:", error_3);
                    return [2 /*return*/, res.status(500).json({ error: "Failed to load usage events" })];
                case 3: return [2 /*return*/];
            }
        });
    }); });
}

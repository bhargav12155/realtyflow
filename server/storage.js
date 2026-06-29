"use strict";
var __makeTemplateObject = (this && this.__makeTemplateObject) || function (cooked, raw) {
    if (Object.defineProperty) { Object.defineProperty(cooked, "raw", { value: raw }); } else { cooked.raw = raw; }
    return cooked;
};
var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
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
var __spreadArray = (this && this.__spreadArray) || function (to, from, pack) {
    if (pack || arguments.length === 2) for (var i = 0, l = from.length, ar; i < l; i++) {
        if (ar || !(i in from)) {
            if (!ar) ar = Array.prototype.slice.call(from, 0, i);
            ar[i] = from[i];
        }
    }
    return to.concat(ar || Array.prototype.slice.call(from));
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.storage = exports.MemStorage = exports.BOARD_MESSAGES_CAP_MAX = exports.BOARD_MESSAGES_CAP_MIN = exports.BOARD_MESSAGES_CAP = void 0;
exports.clampBoardMessagesCap = clampBoardMessagesCap;
exports.isAdminAlertSnoozedFromUser = isAdminAlertSnoozedFromUser;
var schema_1 = require("@shared/schema");
var crypto_1 = require("crypto");
var drizzle_orm_1 = require("drizzle-orm");
var db_1 = require("./db");
/**
 * Default per-board cap on persisted chat messages, used for any board that
 * doesn't have an explicit `chatHistoryCap` value. Each board now stores its
 * own cap so owners can tune it from the chat panel; this constant only
 * serves as the fallback for legacy rows / new boards.
 */
exports.BOARD_MESSAGES_CAP = 200;
/**
 * Inclusive bounds for the per-board chat history cap. The minimum keeps the
 * conversation useful (a handful of turns is meaningless); the maximum stops
 * runaway growth even if an owner cranks the slider.
 */
exports.BOARD_MESSAGES_CAP_MIN = 10;
exports.BOARD_MESSAGES_CAP_MAX = 2000;
function clampBoardMessagesCap(value) {
    if (typeof value !== "number" || !Number.isFinite(value)) {
        return exports.BOARD_MESSAGES_CAP;
    }
    var rounded = Math.floor(value);
    if (rounded < exports.BOARD_MESSAGES_CAP_MIN)
        return exports.BOARD_MESSAGES_CAP_MIN;
    if (rounded > exports.BOARD_MESSAGES_CAP_MAX)
        return exports.BOARD_MESSAGES_CAP_MAX;
    return rounded;
}
var EMAIL_SHARE_PREFIX = "email:";
function normalizeShareEmail(email) {
    return email.trim().toLowerCase();
}
function emailShareIdFromEmail(email) {
    return "".concat(EMAIL_SHARE_PREFIX).concat(normalizeShareEmail(email));
}
function parseEmailFromShareRecipientId(recipientId) {
    if (!recipientId.startsWith(EMAIL_SHARE_PREFIX))
        return null;
    var email = normalizeShareEmail(recipientId.slice(EMAIL_SHARE_PREFIX.length));
    return email.length > 0 ? email : null;
}
/**
 * Returns true when the given admin user row has an active snooze window.
 * Reads `adminAlertSnoozedUntil` directly so callers that already have the
 * user record (e.g. the websocket broadcast loop, which loads every admin
 * up-front) can skip an extra database round-trip per admin in the hot
 * path.
 */
function isAdminAlertSnoozedFromUser(user) {
    var _a;
    var until = (_a = user === null || user === void 0 ? void 0 : user.adminAlertSnoozedUntil) !== null && _a !== void 0 ? _a : null;
    if (!until)
        return false;
    return until.getTime() > Date.now();
}
var MemStorage = /** @class */ (function () {
    function MemStorage() {
        this.users = new Map();
        this.contentPieces = new Map();
        this.socialMediaAccounts = new Map();
        this.seoKeywords = new Map();
        this.marketData = new Map();
        this.analytics = new Map();
        this.scheduledPosts = new Map();
        this.avatars = new Map();
        this.videoContent = new Map();
        this.customVoices = new Map();
        this.photoAvatarGroupVoices = new Map();
        this.mediaAssets = new Map();
        this.postMedia = new Map();
        this.mobileUploadSessions = new Map();
        this.eventSources = new Map();
        this.events = new Map();
        this.eventPostSuggestions = new Map();
        this.complianceSettings = new Map();
        this.videoTemplates = new Map();
        this.templateVariables = new Map();
        this.generatedVideos = new Map();
        this.seedData();
    }
    MemStorage.prototype.seedData = function () {
        var _this = this;
        // Create default user (Mike Bjork)
        var userId = (0, crypto_1.randomUUID)();
        var user = {
            id: userId,
            username: "mikebjork",
            password: "password",
            name: "Mike Bjork",
            email: "mike@bjorkgroup.com",
            role: "team_lead",
            isDemo: false,
            emailNotifications: true,
            adminAlertSnoozedUntil: null,
            createdAt: new Date(),
        };
        this.users.set(userId, user);
        // Seed market data for Omaha neighborhoods
        var neighborhoods = [
            {
                name: "Aksarben",
                avgPrice: 425000,
                daysOnMarket: 18,
                inventory: "0.8 months",
                priceGrowth: "+15.2%",
                trend: "hot",
            },
            {
                name: "Dundee",
                avgPrice: 385000,
                daysOnMarket: 12,
                inventory: "0.6 months",
                priceGrowth: "+12.8%",
                trend: "rising",
            },
            {
                name: "Blackstone",
                avgPrice: 225000,
                daysOnMarket: 28,
                inventory: "1.4 months",
                priceGrowth: "+6.4%",
                trend: "steady",
            },
            {
                name: "Old Market",
                avgPrice: 350000,
                daysOnMarket: 22,
                inventory: "1.1 months",
                priceGrowth: "+9.1%",
                trend: "rising",
            },
            {
                name: "Benson",
                avgPrice: 195000,
                daysOnMarket: 35,
                inventory: "1.8 months",
                priceGrowth: "+4.2%",
                trend: "steady",
            },
        ];
        neighborhoods.forEach(function (n) {
            var marketId = (0, crypto_1.randomUUID)();
            var market = {
                id: marketId,
                userId: userId, // Associate market data with the seeded user
                neighborhood: n.name,
                avgPrice: n.avgPrice,
                daysOnMarket: n.daysOnMarket,
                inventory: n.inventory,
                priceGrowth: n.priceGrowth,
                trend: n.trend,
                lastUpdated: new Date(),
            };
            _this.marketData.set(marketId, market);
        });
        // SEO keywords will be AI-generated on first login based on user's service areas and specialties
        // No seed keywords - users start with empty keyword list
        // Seed analytics data
        var metrics = [
            { metric: "monthly_leads", value: 847 },
            { metric: "content_published", value: 23 },
            { metric: "seo_ranking", value: 32 }, // avg position * 10
            { metric: "social_engagement", value: 4800 },
            { metric: "site_health", value: 94 },
            { metric: "monthly_visitors", value: 12000 },
        ];
        metrics.forEach(function (m) {
            var analyticsId = (0, crypto_1.randomUUID)();
            var analytic = {
                id: analyticsId,
                userId: userId,
                metric: m.metric,
                value: m.value,
                date: new Date(),
                metadata: null,
            };
            _this.analytics.set(analyticsId, analytic);
        });
        // Scheduled posts will be generated on-demand via "Generate Content Plan" button
        // No seed posts - users start with empty calendar
        // Create default avatar with user's actual name
        this.createDefaultAvatar(userId, user.name);
        // Create sample video content
        this.createSampleVideoContent(userId);
    };
    MemStorage.prototype.getUser = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var memUser, db_2, dbUser, error_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        memUser = this.users.get(id);
                        if (memUser) {
                            console.log("[STORAGE] getUser(".concat(id, ") - Found in memory"));
                            return [2 /*return*/, memUser];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 2:
                        db_2 = (_a.sent()).db;
                        return [4 /*yield*/, db_2.query.users.findFirst({
                                where: function (table, _a) {
                                    var eq = _a.eq;
                                    return eq(table.id, id);
                                },
                            })];
                    case 3:
                        dbUser = _a.sent();
                        if (dbUser) {
                            console.log("[STORAGE] getUser(".concat(id, ") - Found in database"));
                            return [2 /*return*/, dbUser];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_1 = _a.sent();
                        console.error("[STORAGE] getUser(".concat(id, ") - Database error:"), error_1);
                        return [3 /*break*/, 5];
                    case 5:
                        console.log("[STORAGE] getUser(".concat(id, ") - Not found"));
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    MemStorage.prototype.getUsersByIds = function (ids) {
        return __awaiter(this, void 0, void 0, function () {
            var unique, found, missing, _i, unique_1, id, memUser, db_3, rows, _a, rows_1, row, error_2;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        if (!ids.length)
                            return [2 /*return*/, []];
                        unique = Array.from(new Set(ids));
                        found = [];
                        missing = [];
                        for (_i = 0, unique_1 = unique; _i < unique_1.length; _i++) {
                            id = unique_1[_i];
                            memUser = this.users.get(id);
                            if (memUser)
                                found.push(memUser);
                            else
                                missing.push(id);
                        }
                        if (!missing.length) return [3 /*break*/, 5];
                        _b.label = 1;
                    case 1:
                        _b.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 2:
                        db_3 = (_b.sent()).db;
                        return [4 /*yield*/, db_3
                                .select()
                                .from(schema_1.users)
                                .where((0, drizzle_orm_1.inArray)(schema_1.users.id, missing))];
                    case 3:
                        rows = _b.sent();
                        for (_a = 0, rows_1 = rows; _a < rows_1.length; _a++) {
                            row = rows_1[_a];
                            found.push(row);
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_2 = _b.sent();
                        console.error("[STORAGE] getUsersByIds - Database error:", error_2);
                        return [3 /*break*/, 5];
                    case 5: return [2 /*return*/, found];
                }
            });
        });
    };
    MemStorage.prototype.getPublicUserById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db_4, publicUsers, result, error_3;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db_4 = (_a.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@shared/schema"); })];
                    case 2:
                        publicUsers = (_a.sent()).publicUsers;
                        return [4 /*yield*/, db_4.select({
                                id: publicUsers.id,
                                email: publicUsers.email,
                                role: publicUsers.role,
                            }).from(publicUsers).where((0, drizzle_orm_1.eq)(publicUsers.id, id)).limit(1)];
                    case 3:
                        result = _a.sent();
                        return [2 /*return*/, result[0]];
                    case 4:
                        error_3 = _a.sent();
                        console.error("[STORAGE] getPublicUserById(".concat(id, ") - Error:"), error_3);
                        return [2 /*return*/, undefined];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.getUserByUsername = function (username) {
        return __awaiter(this, void 0, void 0, function () {
            var memUser, db_5, dbUser, error_4;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        memUser = Array.from(this.users.values()).find(function (user) { return user.username === username; });
                        if (memUser) {
                            console.log("[STORAGE] getUserByUsername(".concat(username, ") - Found in memory: ").concat(memUser.id));
                            return [2 /*return*/, memUser];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 2:
                        db_5 = (_a.sent()).db;
                        return [4 /*yield*/, db_5.query.users.findFirst({
                                where: function (table, _a) {
                                    var eq = _a.eq;
                                    return eq(table.username, username);
                                },
                            })];
                    case 3:
                        dbUser = _a.sent();
                        if (dbUser) {
                            console.log("[STORAGE] getUserByUsername(".concat(username, ") - Found in database: ").concat(dbUser.id));
                            return [2 /*return*/, dbUser];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_4 = _a.sent();
                        console.error("[STORAGE] getUserByUsername(".concat(username, ") - Database error:"), error_4);
                        return [3 /*break*/, 5];
                    case 5:
                        console.log("[STORAGE] getUserByUsername(".concat(username, ") - Not found"));
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    MemStorage.prototype.getUserByEmail = function (email) {
        return __awaiter(this, void 0, void 0, function () {
            var memUser, db_6, dbUser, error_5;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        memUser = Array.from(this.users.values()).find(function (user) { return user.email === email; });
                        if (memUser) {
                            console.log("[STORAGE] getUserByEmail(".concat(email, ") - Found in memory: ").concat(memUser.id));
                            return [2 /*return*/, memUser];
                        }
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 2:
                        db_6 = (_a.sent()).db;
                        return [4 /*yield*/, db_6.query.users.findFirst({
                                where: function (table, _a) {
                                    var eq = _a.eq;
                                    return eq(table.email, email);
                                },
                            })];
                    case 3:
                        dbUser = _a.sent();
                        if (dbUser) {
                            console.log("[STORAGE] getUserByEmail(".concat(email, ") - Found in database: ").concat(dbUser.id));
                            return [2 /*return*/, dbUser];
                        }
                        return [3 /*break*/, 5];
                    case 4:
                        error_5 = _a.sent();
                        console.error("[STORAGE] getUserByEmail(".concat(email, ") - Database error:"), error_5);
                        return [3 /*break*/, 5];
                    case 5:
                        console.log("[STORAGE] getUserByEmail(".concat(email, ") - Not found"));
                        return [2 /*return*/, undefined];
                }
            });
        });
    };
    MemStorage.prototype.getAllUsers = function () {
        return __awaiter(this, void 0, void 0, function () {
            var memUsers, db_7, dbUsers, allUsers, _loop_1, _i, dbUsers_1, dbUser, error_6;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        memUsers = Array.from(this.users.values());
                        _a.label = 1;
                    case 1:
                        _a.trys.push([1, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 2:
                        db_7 = (_a.sent()).db;
                        return [4 /*yield*/, db_7.query.users.findMany()];
                    case 3:
                        dbUsers = _a.sent();
                        allUsers = __spreadArray([], memUsers, true);
                        _loop_1 = function (dbUser) {
                            if (!allUsers.some(function (u) { return u.id === dbUser.id; })) {
                                allUsers.push(dbUser);
                            }
                        };
                        for (_i = 0, dbUsers_1 = dbUsers; _i < dbUsers_1.length; _i++) {
                            dbUser = dbUsers_1[_i];
                            _loop_1(dbUser);
                        }
                        return [2 /*return*/, allUsers];
                    case 4:
                        error_6 = _a.sent();
                        console.error('[STORAGE] getAllUsers - Database error:', error_6);
                        return [2 /*return*/, memUsers];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.createUser = function (insertUser) {
        return __awaiter(this, void 0, void 0, function () {
            var id, user;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                id = insertUser.id || (0, crypto_1.randomUUID)();
                user = __assign(__assign({}, insertUser), { id: id, createdAt: new Date(), role: insertUser.role || "agent", isDemo: (_a = insertUser.isDemo) !== null && _a !== void 0 ? _a : false, emailNotifications: (_b = insertUser.emailNotifications) !== null && _b !== void 0 ? _b : true, adminAlertSnoozedUntil: (_c = insertUser.adminAlertSnoozedUntil) !== null && _c !== void 0 ? _c : null });
                this.users.set(id, user);
                console.log("[STORAGE] createUser - Created user with ID: ".concat(id, " (email: ").concat(insertUser.email, ")"));
                return [2 /*return*/, user];
            });
        });
    };
    MemStorage.prototype.getWalletAccount = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var row, created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.walletAccounts)
                            .values({ userId: userId })
                            .onConflictDoNothing({ target: schema_1.walletAccounts.userId })];
                    case 1:
                        _a.sent();
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.walletAccounts)
                                .where((0, drizzle_orm_1.eq)(schema_1.walletAccounts.userId, userId))
                                .limit(1)];
                    case 2:
                        row = (_a.sent())[0];
                        if (row)
                            return [2 /*return*/, row];
                        return [4 /*yield*/, db_1.db
                                .insert(schema_1.walletAccounts)
                                .values({ userId: userId, balanceCredits: 0 })
                                .returning()];
                    case 3:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.debitWalletCredits = function (userId, amount, reason, options) {
        return __awaiter(this, void 0, void 0, function () {
            var debitAmount, wallet;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        debitAmount = Math.max(0, Math.trunc(amount));
                        if (!(debitAmount === 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getWalletAccount(userId)];
                    case 1:
                        wallet = _a.sent();
                        return [2 /*return*/, { success: true, balance: wallet.balanceCredits }];
                    case 2: return [4 /*yield*/, db_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var updated, current;
                            var _a, _b, _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0: return [4 /*yield*/, tx
                                            .insert(schema_1.walletAccounts)
                                            .values({ userId: userId })
                                            .onConflictDoNothing({ target: schema_1.walletAccounts.userId })];
                                    case 1:
                                        _d.sent();
                                        return [4 /*yield*/, tx
                                                .update(schema_1.walletAccounts)
                                                .set({
                                                balanceCredits: (0, drizzle_orm_1.sql)(templateObject_1 || (templateObject_1 = __makeTemplateObject(["", " - ", ""], ["", " - ", ""])), schema_1.walletAccounts.balanceCredits, debitAmount),
                                                updatedAt: new Date(),
                                            })
                                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.walletAccounts.userId, userId), (0, drizzle_orm_1.gte)(schema_1.walletAccounts.balanceCredits, debitAmount)))
                                                .returning()];
                                    case 2:
                                        updated = (_d.sent())[0];
                                        if (!!updated) return [3 /*break*/, 4];
                                        return [4 /*yield*/, tx
                                                .select()
                                                .from(schema_1.walletAccounts)
                                                .where((0, drizzle_orm_1.eq)(schema_1.walletAccounts.userId, userId))
                                                .limit(1)];
                                    case 3:
                                        current = (_d.sent())[0];
                                        return [2 /*return*/, { success: false, balance: (_a = current === null || current === void 0 ? void 0 : current.balanceCredits) !== null && _a !== void 0 ? _a : 0 }];
                                    case 4: return [4 /*yield*/, tx.insert(schema_1.walletLedger).values({
                                            userId: userId,
                                            deltaCredits: -debitAmount,
                                            balanceAfter: updated.balanceCredits,
                                            reason: reason,
                                            requestId: (_b = options === null || options === void 0 ? void 0 : options.requestId) !== null && _b !== void 0 ? _b : null,
                                            metadata: (_c = options === null || options === void 0 ? void 0 : options.metadata) !== null && _c !== void 0 ? _c : null,
                                        })];
                                    case 5:
                                        _d.sent();
                                        return [2 /*return*/, { success: true, balance: updated.balanceCredits }];
                                }
                            });
                        }); })];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.creditWalletCredits = function (userId, amount, reason, options) {
        return __awaiter(this, void 0, void 0, function () {
            var creditAmount, wallet;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        creditAmount = Math.max(0, Math.trunc(amount));
                        if (!(creditAmount === 0)) return [3 /*break*/, 2];
                        return [4 /*yield*/, this.getWalletAccount(userId)];
                    case 1:
                        wallet = _a.sent();
                        return [2 /*return*/, { balance: wallet.balanceCredits }];
                    case 2: return [4 /*yield*/, db_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                            var updated, balance;
                            var _a, _b, _c;
                            return __generator(this, function (_d) {
                                switch (_d.label) {
                                    case 0: return [4 /*yield*/, tx
                                            .insert(schema_1.walletAccounts)
                                            .values({ userId: userId })
                                            .onConflictDoNothing({ target: schema_1.walletAccounts.userId })];
                                    case 1:
                                        _d.sent();
                                        return [4 /*yield*/, tx
                                                .update(schema_1.walletAccounts)
                                                .set({
                                                balanceCredits: (0, drizzle_orm_1.sql)(templateObject_2 || (templateObject_2 = __makeTemplateObject(["", " + ", ""], ["", " + ", ""])), schema_1.walletAccounts.balanceCredits, creditAmount),
                                                updatedAt: new Date(),
                                            })
                                                .where((0, drizzle_orm_1.eq)(schema_1.walletAccounts.userId, userId))
                                                .returning()];
                                    case 2:
                                        updated = (_d.sent())[0];
                                        balance = (_a = updated === null || updated === void 0 ? void 0 : updated.balanceCredits) !== null && _a !== void 0 ? _a : 0;
                                        return [4 /*yield*/, tx.insert(schema_1.walletLedger).values({
                                                userId: userId,
                                                deltaCredits: creditAmount,
                                                balanceAfter: balance,
                                                reason: reason,
                                                requestId: (_b = options === null || options === void 0 ? void 0 : options.requestId) !== null && _b !== void 0 ? _b : null,
                                                metadata: (_c = options === null || options === void 0 ? void 0 : options.metadata) !== null && _c !== void 0 ? _c : null,
                                            })];
                                    case 3:
                                        _d.sent();
                                        return [2 /*return*/, { balance: balance }];
                                }
                            });
                        }); })];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.recordAiUsageEvent = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.aiUsageEvents).values(event).returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.getContentPieces = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var db_8, contentPiecesTable, _a, eq_1, desc_1, rows, error_7;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        _b.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db_8 = (_b.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@shared/schema"); })];
                    case 2:
                        contentPiecesTable = (_b.sent()).contentPieces;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("drizzle-orm"); })];
                    case 3:
                        _a = _b.sent(), eq_1 = _a.eq, desc_1 = _a.desc;
                        return [4 /*yield*/, db_8.select().from(contentPiecesTable).where(eq_1(contentPiecesTable.userId, userId)).orderBy(desc_1(contentPiecesTable.createdAt))];
                    case 4:
                        rows = _b.sent();
                        return [2 /*return*/, rows];
                    case 5:
                        error_7 = _b.sent();
                        console.error("[STORAGE] getContentPieces DB error, falling back to memory:", error_7);
                        return [2 /*return*/, Array.from(this.contentPieces.values()).filter(function (content) { return content.userId === userId; })];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.getContentPieceById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db_9, contentPiecesTable, eq_2, rows, error_8;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db_9 = (_a.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@shared/schema"); })];
                    case 2:
                        contentPiecesTable = (_a.sent()).contentPieces;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("drizzle-orm"); })];
                    case 3:
                        eq_2 = (_a.sent()).eq;
                        return [4 /*yield*/, db_9.select().from(contentPiecesTable).where(eq_2(contentPiecesTable.id, id))];
                    case 4:
                        rows = _a.sent();
                        return [2 /*return*/, rows[0] || undefined];
                    case 5:
                        error_8 = _a.sent();
                        console.error("[STORAGE] getContentPieceById DB error:", error_8);
                        return [2 /*return*/, this.contentPieces.get(id)];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.createContentPiece = function (insertContent) {
        return __awaiter(this, void 0, void 0, function () {
            var db_10, contentPiecesTable, created, error_9, id, content;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 4, , 5]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db_10 = (_a.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@shared/schema"); })];
                    case 2:
                        contentPiecesTable = (_a.sent()).contentPieces;
                        return [4 /*yield*/, db_10.insert(contentPiecesTable).values({
                                userId: insertContent.userId,
                                type: insertContent.type,
                                title: insertContent.title,
                                content: insertContent.content,
                                keywords: insertContent.keywords || null,
                                neighborhood: insertContent.neighborhood || null,
                                seoOptimized: insertContent.seoOptimized || false,
                                status: insertContent.status || "draft",
                                publishedAt: insertContent.publishedAt || null,
                                scheduledFor: insertContent.scheduledFor || null,
                                socialPlatforms: insertContent.socialPlatforms || null,
                                metadata: insertContent.metadata || null,
                            }).returning()];
                    case 3:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                    case 4:
                        error_9 = _a.sent();
                        console.error("[STORAGE] createContentPiece DB error, falling back to memory:", error_9);
                        id = (0, crypto_1.randomUUID)();
                        content = __assign(__assign({}, insertContent), { id: id, createdAt: new Date(), metadata: insertContent.metadata || null, neighborhood: insertContent.neighborhood || null, keywords: insertContent.keywords || null, seoOptimized: insertContent.seoOptimized || false, status: insertContent.status || "draft", publishedAt: insertContent.publishedAt || null, scheduledFor: insertContent.scheduledFor || null });
                        this.contentPieces.set(id, content);
                        return [2 /*return*/, content];
                    case 5: return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.updateContentPiece = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var db_11, contentPiecesTable, eq_3, updated, error_10, content, updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db_11 = (_a.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@shared/schema"); })];
                    case 2:
                        contentPiecesTable = (_a.sent()).contentPieces;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("drizzle-orm"); })];
                    case 3:
                        eq_3 = (_a.sent()).eq;
                        return [4 /*yield*/, db_11.update(contentPiecesTable).set(updates).where(eq_3(contentPiecesTable.id, id)).returning()];
                    case 4:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated || undefined];
                    case 5:
                        error_10 = _a.sent();
                        console.error("[STORAGE] updateContentPiece DB error:", error_10);
                        content = this.contentPieces.get(id);
                        if (!content)
                            return [2 /*return*/, undefined];
                        updated = __assign(__assign({}, content), updates);
                        this.contentPieces.set(id, updated);
                        return [2 /*return*/, updated];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.deleteContentPiece = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db_12, contentPiecesTable, eq_4, result, error_11;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        _a.trys.push([0, 5, , 6]);
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db_12 = (_a.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("@shared/schema"); })];
                    case 2:
                        contentPiecesTable = (_a.sent()).contentPieces;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("drizzle-orm"); })];
                    case 3:
                        eq_4 = (_a.sent()).eq;
                        return [4 /*yield*/, db_12.delete(contentPiecesTable).where(eq_4(contentPiecesTable.id, id))];
                    case 4:
                        result = _a.sent();
                        return [2 /*return*/, true];
                    case 5:
                        error_11 = _a.sent();
                        console.error("[STORAGE] deleteContentPiece DB error:", error_11);
                        return [2 /*return*/, this.contentPieces.delete(id)];
                    case 6: return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.getSocialMediaAccounts = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var db, socialMediaAccountsTable, accounts;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db = (_a.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("../shared/schema"); })];
                    case 2:
                        socialMediaAccountsTable = (_a.sent()).socialMediaAccounts;
                        return [4 /*yield*/, db.query.socialMediaAccounts.findMany({
                                where: function (table, _a) {
                                    var eq = _a.eq;
                                    return eq(table.userId, userId);
                                },
                            })];
                    case 3:
                        accounts = _a.sent();
                        console.log("[STORAGE] Found ".concat(accounts.length, " social media accounts for user ").concat(userId));
                        return [2 /*return*/, accounts];
                }
            });
        });
    };
    MemStorage.prototype.getSocialMediaAccountById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var db, account;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db = (_a.sent()).db;
                        return [4 /*yield*/, db.query.socialMediaAccounts.findFirst({
                                where: function (table, _a) {
                                    var eq = _a.eq;
                                    return eq(table.id, id);
                                },
                            })];
                    case 2:
                        account = _a.sent();
                        return [2 /*return*/, account];
                }
            });
        });
    };
    MemStorage.prototype.createSocialMediaAccount = function (insertAccount) {
        return __awaiter(this, void 0, void 0, function () {
            var db, socialMediaAccountsTable, account;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db = (_b.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("../shared/schema"); })];
                    case 2:
                        socialMediaAccountsTable = (_b.sent()).socialMediaAccounts;
                        return [4 /*yield*/, db
                                .insert(socialMediaAccountsTable)
                                .values(__assign(__assign({}, insertAccount), { isConnected: (_a = insertAccount.isConnected) !== null && _a !== void 0 ? _a : true }))
                                .returning()];
                    case 3:
                        account = (_b.sent())[0];
                        console.log("[STORAGE] Created social media account for user ".concat(insertAccount.userId, ", platform ").concat(insertAccount.platform));
                        return [2 /*return*/, account];
                }
            });
        });
    };
    MemStorage.prototype.updateSocialMediaAccount = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var db, socialMediaAccountsTable, updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db = (_a.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("../shared/schema"); })];
                    case 2:
                        socialMediaAccountsTable = (_a.sent()).socialMediaAccounts;
                        return [4 /*yield*/, db
                                .update(socialMediaAccountsTable)
                                .set(updates)
                                .where((0, drizzle_orm_1.eq)(socialMediaAccountsTable.id, id))
                                .returning()];
                    case 3:
                        updated = (_a.sent())[0];
                        console.log("[STORAGE] Updated social media account ".concat(id));
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.disconnectSocialMediaAccount = function (userId, platform) {
        return __awaiter(this, void 0, void 0, function () {
            var db, socialMediaAccountsTable, account, updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("./db"); })];
                    case 1:
                        db = (_a.sent()).db;
                        return [4 /*yield*/, Promise.resolve().then(function () { return require("../shared/schema"); })];
                    case 2:
                        socialMediaAccountsTable = (_a.sent()).socialMediaAccounts;
                        return [4 /*yield*/, db.query.socialMediaAccounts.findFirst({
                                where: function (table, _a) {
                                    var eq = _a.eq, and = _a.and;
                                    return and(eq(table.userId, userId), eq(table.platform, platform));
                                },
                            })];
                    case 3:
                        account = _a.sent();
                        if (!account) {
                            console.log("[STORAGE] No account found for user ".concat(userId, ", platform ").concat(platform));
                            return [2 /*return*/, undefined];
                        }
                        if (!account.isConnected) {
                            console.log("[STORAGE] Account already disconnected for user ".concat(userId, ", platform ").concat(platform));
                            return [2 /*return*/, account]; // Already disconnected
                        }
                        return [4 /*yield*/, db
                                .update(socialMediaAccountsTable)
                                .set({
                                isConnected: false,
                                accessToken: null,
                                refreshToken: null,
                                lastSync: null,
                            })
                                .where((0, drizzle_orm_1.eq)(socialMediaAccountsTable.id, account.id))
                                .returning()];
                    case 4:
                        updated = (_a.sent())[0];
                        console.log("[STORAGE] Disconnected social media account for user ".concat(userId, ", platform ").concat(platform));
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.getSeoKeywords = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.seoKeywords.values()).filter(function (keyword) { return keyword.userId === userId; })];
            });
        });
    };
    MemStorage.prototype.createSeoKeyword = function (insertKeyword) {
        return __awaiter(this, void 0, void 0, function () {
            var id, keyword;
            return __generator(this, function (_a) {
                id = (0, crypto_1.randomUUID)();
                keyword = __assign(__assign({}, insertKeyword), { id: id, createdAt: new Date(), neighborhood: insertKeyword.neighborhood || null, currentRank: insertKeyword.currentRank || null, previousRank: insertKeyword.previousRank || null, searchVolume: insertKeyword.searchVolume || null, difficulty: insertKeyword.difficulty || null, lastChecked: insertKeyword.lastChecked || null });
                this.seoKeywords.set(id, keyword);
                return [2 /*return*/, keyword];
            });
        });
    };
    MemStorage.prototype.updateSeoKeyword = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var keyword, updated;
            return __generator(this, function (_a) {
                keyword = this.seoKeywords.get(id);
                if (!keyword)
                    return [2 /*return*/, undefined];
                updated = __assign(__assign({}, keyword), updates);
                this.seoKeywords.set(id, updated);
                return [2 /*return*/, updated];
            });
        });
    };
    MemStorage.prototype.getMarketData = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.marketData.values()).filter(function (data) { return data.userId === userId; })];
            });
        });
    };
    MemStorage.prototype.getMarketDataByNeighborhood = function (userId, neighborhood) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.marketData.values()).find(function (data) { return data.userId === userId && data.neighborhood === neighborhood; })];
            });
        });
    };
    MemStorage.prototype.createMarketData = function (insertData) {
        return __awaiter(this, void 0, void 0, function () {
            var id, data;
            return __generator(this, function (_a) {
                id = (0, crypto_1.randomUUID)();
                data = __assign(__assign({}, insertData), { id: id, avgPrice: insertData.avgPrice || null, daysOnMarket: insertData.daysOnMarket || null, inventory: insertData.inventory || null, priceGrowth: insertData.priceGrowth || null, trend: insertData.trend || null, lastUpdated: new Date() });
                this.marketData.set(id, data);
                return [2 /*return*/, data];
            });
        });
    };
    MemStorage.prototype.updateMarketData = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var data, updated;
            return __generator(this, function (_a) {
                data = this.marketData.get(id);
                if (!data)
                    return [2 /*return*/, undefined];
                updated = __assign(__assign({}, data), updates);
                this.marketData.set(id, updated);
                return [2 /*return*/, updated];
            });
        });
    };
    MemStorage.prototype.refreshMarketData = function (userId, neighborhoods) {
        return __awaiter(this, void 0, void 0, function () {
            var userMarketDataIds, newMarketData, _i, neighborhoods_1, neighborhood, id, data;
            var _this = this;
            return __generator(this, function (_a) {
                userMarketDataIds = Array.from(this.marketData.entries())
                    .filter(function (_a) {
                    var _ = _a[0], data = _a[1];
                    return data.userId === userId;
                })
                    .map(function (_a) {
                    var id = _a[0], _ = _a[1];
                    return id;
                });
                userMarketDataIds.forEach(function (id) { return _this.marketData.delete(id); });
                newMarketData = [];
                for (_i = 0, neighborhoods_1 = neighborhoods; _i < neighborhoods_1.length; _i++) {
                    neighborhood = neighborhoods_1[_i];
                    // Verify userId matches (security check)
                    if (neighborhood.userId !== userId) {
                        console.warn("\u26A0\uFE0F  Skipping neighborhood with mismatched userId: ".concat(neighborhood.userId, " !== ").concat(userId));
                        continue;
                    }
                    id = (0, crypto_1.randomUUID)();
                    data = __assign(__assign({}, neighborhood), { id: id, avgPrice: neighborhood.avgPrice || null, daysOnMarket: neighborhood.daysOnMarket || null, inventory: neighborhood.inventory || null, priceGrowth: neighborhood.priceGrowth || null, trend: neighborhood.trend || null, lastUpdated: new Date() });
                    this.marketData.set(id, data);
                    newMarketData.push(data);
                }
                console.log("\uD83D\uDCCA Refreshed market data for user ".concat(userId, ": ").concat(newMarketData.length, " neighborhoods"));
                return [2 /*return*/, newMarketData];
            });
        });
    };
    MemStorage.prototype.getAnalytics = function (userId, metric) {
        return __awaiter(this, void 0, void 0, function () {
            var userAnalytics;
            return __generator(this, function (_a) {
                userAnalytics = Array.from(this.analytics.values()).filter(function (a) { return a.userId === userId; });
                if (metric) {
                    return [2 /*return*/, userAnalytics.filter(function (a) { return a.metric === metric; })];
                }
                return [2 /*return*/, userAnalytics];
            });
        });
    };
    MemStorage.prototype.createAnalytics = function (insertAnalytics) {
        return __awaiter(this, void 0, void 0, function () {
            var id, analytics;
            return __generator(this, function (_a) {
                id = (0, crypto_1.randomUUID)();
                analytics = __assign(__assign({}, insertAnalytics), { id: id, metadata: insertAnalytics.metadata || null, date: insertAnalytics.date || new Date() });
                this.analytics.set(id, analytics);
                return [2 /*return*/, analytics];
            });
        });
    };
    MemStorage.prototype.getScheduledPosts = function (userId, status) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!status) return [3 /*break*/, 2];
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.scheduledPosts)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.scheduledPosts.userId, userId), (0, drizzle_orm_1.eq)(schema_1.scheduledPosts.status, status)))
                                .orderBy(schema_1.scheduledPosts.scheduledFor)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.scheduledPosts)
                            .where((0, drizzle_orm_1.eq)(schema_1.scheduledPosts.userId, userId))
                            .orderBy(schema_1.scheduledPosts.scheduledFor)];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getScheduledPostById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var post;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.scheduledPosts)
                            .where((0, drizzle_orm_1.eq)(schema_1.scheduledPosts.id, id))
                            .limit(1)];
                    case 1:
                        post = (_a.sent())[0];
                        return [2 /*return*/, post];
                }
            });
        });
    };
    MemStorage.prototype.createScheduledPost = function (insertPost) {
        return __awaiter(this, void 0, void 0, function () {
            var post;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.scheduledPosts)
                            .values(__assign(__assign({}, insertPost), { metadata: insertPost.metadata || null, isEdited: insertPost.isEdited || false, originalContent: insertPost.originalContent || null, neighborhood: insertPost.neighborhood || null, hashtags: insertPost.hashtags || null, postType: insertPost.postType || null, status: insertPost.status || "pending", seoScore: (_a = insertPost.seoScore) !== null && _a !== void 0 ? _a : 0 }))
                            .returning()];
                    case 1:
                        post = (_b.sent())[0];
                        return [2 /*return*/, post];
                }
            });
        });
    };
    MemStorage.prototype.updateScheduledPost = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, post;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getScheduledPostById(id)];
                    case 1:
                        existing = _a.sent();
                        if (!existing)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.scheduledPosts)
                                .set(__assign(__assign({}, updates), { updatedAt: new Date(), isEdited: updates.content && updates.content !== existing.originalContent
                                    ? true
                                    : existing.isEdited }))
                                .where((0, drizzle_orm_1.eq)(schema_1.scheduledPosts.id, id))
                                .returning()];
                    case 2:
                        post = (_a.sent())[0];
                        return [2 /*return*/, post];
                }
            });
        });
    };
    MemStorage.prototype.deleteScheduledPost = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.scheduledPosts)
                            .where((0, drizzle_orm_1.eq)(schema_1.scheduledPosts.id, id))
                            .returning()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.length > 0];
                }
            });
        });
    };
    MemStorage.prototype.deleteScheduledPostsBulk = function (ids, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (ids.length === 0)
                            return [2 /*return*/, 0];
                        return [4 /*yield*/, db_1.db
                                .delete(schema_1.scheduledPosts)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.inArray)(schema_1.scheduledPosts.id, ids), (0, drizzle_orm_1.eq)(schema_1.scheduledPosts.userId, userId)))
                                .returning()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.length];
                }
            });
        });
    };
    MemStorage.prototype.deleteAllScheduledPosts = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.scheduledPosts)
                            .where((0, drizzle_orm_1.eq)(schema_1.scheduledPosts.userId, userId))
                            .returning()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.length];
                }
            });
        });
    };
    MemStorage.prototype.generateWeeklyScheduledPosts = function (userId) {
        var neighborhoods = [
            "Dundee",
            "Aksarben",
            "Old Market",
            "Blackstone",
            "Benson",
        ];
        var platforms = ["facebook", "instagram", "linkedin", "x"];
        var localMarketTopics = [
            "Dundee neighborhood walkability and charm",
            "Aksarben Village amenities and luxury living",
            "Old Market historic character and dining scene",
            "Blackstone emerging arts district",
            "Benson affordable family-friendly community",
        ];
        var movingToOmahaTopics = [
            "Best Omaha neighborhoods for families",
            "Omaha job market and major employers",
            "Winter in Omaha: what to expect",
            "Omaha school districts comparison",
            "Cost of living in Omaha vs other cities",
        ];
        var today = new Date();
        var postId = 0;
        // Generate 2 weeks of scheduled posts
        for (var day = 0; day < 14; day++) {
            var scheduleDate = new Date(today);
            scheduleDate.setDate(today.getDate() + day + 1);
            scheduleDate.setHours(9 + (day % 8), 0, 0, 0); // Vary posting times
            var platformIndex = day % platforms.length;
            var platform = platforms[platformIndex];
            var content = void 0, postType = void 0, neighborhood = void 0;
            if (day % 3 === 0) {
                // Local market focus
                var topicIndex = day % localMarketTopics.length;
                content = localMarketTopics[topicIndex];
                postType = "local_market";
                neighborhood = neighborhoods[topicIndex % neighborhoods.length];
            }
            else {
                // Moving to Omaha focus
                var topicIndex = day % movingToOmahaTopics.length;
                content = movingToOmahaTopics[topicIndex];
                postType = "moving_guide";
                neighborhood = null;
            }
            var scheduledPost = {
                id: (0, crypto_1.randomUUID)(),
                userId: userId,
                platform: platform,
                postType: postType,
                content: content,
                hashtags: platform === "instagram"
                    ? ["OmahaRealEstate", "MovingToOmaha", "NebraskaHomes"]
                    : [],
                scheduledFor: scheduleDate,
                status: "pending",
                isEdited: false,
                isAiGenerated: true,
                originalContent: content,
                neighborhood: neighborhood,
                seoScore: 80, // Default SEO score for generated content
                metadata: { generated: true, focus: postType },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            this.scheduledPosts.set(scheduledPost.id, scheduledPost);
        }
    };
    MemStorage.prototype.createDefaultAvatar = function (userId, userName) {
        var displayName = userName || "Professional Agent";
        var avatar = {
            id: (0, crypto_1.randomUUID)(),
            userId: userId,
            name: "".concat(displayName, " - Professional"),
            description: "Professional real estate agent avatar for client-facing content",
            avatarImageUrl: null, // Would be set when user uploads their photo
            voiceId: "119caed25533477ba63822d5d1552d25", // HeyGen default professional voice
            style: "professional",
            gender: "male",
            isActive: true,
            metadata: { defaultAvatar: true },
            createdAt: new Date(),
        };
        this.avatars.set(avatar.id, avatar);
    };
    MemStorage.prototype.createSampleVideoContent = function (userId) {
        var _this = this;
        var sampleTopics = [
            {
                title: "Why Dundee is Perfect for Families",
                topic: "Dundee neighborhood family benefits",
                videoType: "neighborhood_tour",
                neighborhood: "Dundee",
            },
            {
                title: "Moving to Omaha: Your Complete Guide",
                topic: "Complete relocation guide for Omaha",
                videoType: "moving_guide",
                neighborhood: null,
            },
            {
                title: "Omaha Market Update - January 2025",
                topic: "Current market trends and opportunities",
                videoType: "market_update",
                neighborhood: null,
            },
        ];
        sampleTopics.forEach(function (sample, index) {
            var _a;
            var video = {
                id: (0, crypto_1.randomUUID)(),
                userId: userId,
                avatarId: ((_a = Array.from(_this.avatars.values()).find(function (a) { return a.userId === userId; })) === null || _a === void 0 ? void 0 : _a.id) || null,
                title: sample.title,
                script: "Welcome! Today I want to talk about ".concat(sample.topic, ". As your local Omaha real estate expert, I'm here to provide you with valuable insights that can help with your real estate decisions."),
                topic: sample.topic,
                neighborhood: sample.neighborhood,
                videoType: sample.videoType,
                duration: null,
                thumbnailUrl: null,
                videoUrl: null,
                youtubeUrl: null,
                youtubeVideoId: null,
                status: "draft",
                platform: null,
                heygenVideoId: null,
                heygenAvatarId: null,
                heygenVoiceId: null,
                heygenTemplateId: null,
                tags: [
                    "OmahaRealEstate",
                    "RealEstateExpert",
                    "HomesBuying",
                    "Nebraska",
                ],
                seoOptimized: false,
                metadata: { sampleContent: true },
                createdAt: new Date(),
                updatedAt: new Date(),
            };
            _this.videoContent.set(video.id, video);
        });
    };
    // Avatar methods
    MemStorage.prototype.getAvatars = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.avatars.values()).filter(function (avatar) { return avatar.userId === userId; })];
            });
        });
    };
    MemStorage.prototype.getAvatarById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.avatars.get(id)];
            });
        });
    };
    MemStorage.prototype.getAvatarByIdAndUser = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var avatar;
            return __generator(this, function (_a) {
                avatar = this.avatars.get(id);
                if (avatar && avatar.userId === userId) {
                    return [2 /*return*/, avatar];
                }
                return [2 /*return*/, undefined];
            });
        });
    };
    MemStorage.prototype.createAvatar = function (insertAvatar) {
        return __awaiter(this, void 0, void 0, function () {
            var id, avatar;
            return __generator(this, function (_a) {
                id = (0, crypto_1.randomUUID)();
                avatar = __assign(__assign({}, insertAvatar), { id: id, createdAt: new Date(), avatarImageUrl: insertAvatar.avatarImageUrl || null, voiceId: insertAvatar.voiceId || null, description: insertAvatar.description || null, gender: insertAvatar.gender || null, metadata: insertAvatar.metadata || null, style: insertAvatar.style || "professional", isActive: insertAvatar.isActive !== false });
                this.avatars.set(id, avatar);
                return [2 /*return*/, avatar];
            });
        });
    };
    MemStorage.prototype.updateAvatar = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var avatar, updated;
            return __generator(this, function (_a) {
                avatar = this.avatars.get(id);
                if (!avatar)
                    return [2 /*return*/, undefined];
                updated = __assign(__assign({}, avatar), updates);
                this.avatars.set(id, updated);
                return [2 /*return*/, updated];
            });
        });
    };
    MemStorage.prototype.deleteAvatar = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.avatars.delete(id)];
            });
        });
    };
    // Video Content methods
    MemStorage.prototype.getVideoContent = function (userId, status) {
        return __awaiter(this, void 0, void 0, function () {
            var conditions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        conditions = [(0, drizzle_orm_1.eq)(schema_1.videoContent.userId, userId)];
                        if (status) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.videoContent.status, status));
                        }
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.videoContent)
                                .where(drizzle_orm_1.and.apply(void 0, conditions))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.videoContent.createdAt))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getVideoById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var video;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoContent)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoContent.id, id))
                            .limit(1)];
                    case 1:
                        video = (_a.sent())[0];
                        return [2 /*return*/, video];
                }
            });
        });
    };
    MemStorage.prototype.createVideoContent = function (insertVideo) {
        return __awaiter(this, void 0, void 0, function () {
            var video;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.videoContent)
                            .values(__assign(__assign({}, insertVideo), { avatarId: insertVideo.avatarId || null, topic: insertVideo.topic || null, neighborhood: insertVideo.neighborhood || null, videoType: insertVideo.videoType || null, duration: insertVideo.duration || null, thumbnailUrl: insertVideo.thumbnailUrl || null, videoUrl: insertVideo.videoUrl || null, youtubeUrl: insertVideo.youtubeUrl || null, youtubeVideoId: insertVideo.youtubeVideoId || null, tags: insertVideo.tags || null, seoOptimized: insertVideo.seoOptimized || false, metadata: insertVideo.metadata || null, status: insertVideo.status || "draft", platform: insertVideo.platform || null, heygenVideoId: insertVideo.heygenVideoId || null, heygenAvatarId: insertVideo.heygenAvatarId || null, heygenVoiceId: insertVideo.heygenVoiceId || null, heygenTemplateId: insertVideo.heygenTemplateId || null }))
                            .returning()];
                    case 1:
                        video = (_a.sent())[0];
                        return [2 /*return*/, video];
                }
            });
        });
    };
    MemStorage.prototype.updateVideoContent = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.videoContent)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.videoContent.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.deleteVideoContent = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.videoContent)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoContent.id, id))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rowCount ? result.rowCount > 0 : false];
                }
            });
        });
    };
    MemStorage.prototype.getVideoByIdAndUser = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var video;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoContent)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.videoContent.id, id), (0, drizzle_orm_1.eq)(schema_1.videoContent.userId, userId)))
                            .limit(1)];
                    case 1:
                        video = (_a.sent())[0];
                        return [2 /*return*/, video];
                }
            });
        });
    };
    MemStorage.prototype.getVideoByHeygenId = function (heygenVideoId) {
        return __awaiter(this, void 0, void 0, function () {
            var video;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoContent)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoContent.heygenVideoId, heygenVideoId))
                            .limit(1)];
                    case 1:
                        video = (_a.sent())[0];
                        return [2 /*return*/, video];
                }
            });
        });
    };
    MemStorage.prototype.updateVideoContentWithUserGuard = function (id, userId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.videoContent)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.videoContent.id, id), (0, drizzle_orm_1.eq)(schema_1.videoContent.userId, userId)))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.deleteVideoContentWithUserGuard = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.videoContent)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.videoContent.id, id), (0, drizzle_orm_1.eq)(schema_1.videoContent.userId, userId)))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rowCount ? result.rowCount > 0 : false];
                }
            });
        });
    };
    // Custom Voices
    MemStorage.prototype.listCustomVoices = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.customVoices)
                            .where((0, drizzle_orm_1.eq)(schema_1.customVoices.userId, userId))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getCustomVoices = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, this.listCustomVoices(userId)];
            });
        });
    };
    MemStorage.prototype.getCustomVoice = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var voice;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.customVoices)
                            .where((0, drizzle_orm_1.eq)(schema_1.customVoices.id, id))
                            .limit(1)];
                    case 1:
                        voice = (_a.sent())[0];
                        return [2 /*return*/, voice];
                }
            });
        });
    };
    MemStorage.prototype.getCustomVoiceByIdAndUser = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var voice;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.customVoices)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.customVoices.id, id), (0, drizzle_orm_1.eq)(schema_1.customVoices.userId, userId)))
                            .limit(1)];
                    case 1:
                        voice = (_a.sent())[0];
                        return [2 /*return*/, voice];
                }
            });
        });
    };
    MemStorage.prototype.createCustomVoice = function (insertVoice) {
        return __awaiter(this, void 0, void 0, function () {
            var voice;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.customVoices)
                            .values(insertVoice)
                            .returning()];
                    case 1:
                        voice = (_a.sent())[0];
                        return [2 /*return*/, voice];
                }
            });
        });
    };
    MemStorage.prototype.updateCustomVoice = function (id, userId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var voice;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.customVoices)
                            .set(updates)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.customVoices.id, id), (0, drizzle_orm_1.eq)(schema_1.customVoices.userId, userId)))
                            .returning()];
                    case 1:
                        voice = (_a.sent())[0];
                        return [2 /*return*/, voice];
                }
            });
        });
    };
    MemStorage.prototype.deleteCustomVoice = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.customVoices)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.customVoices.id, id), (0, drizzle_orm_1.eq)(schema_1.customVoices.userId, userId)))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    MemStorage.prototype.savePhotoAvatarGroupVoice = function (insertVoice) {
        return __awaiter(this, void 0, void 0, function () {
            var voice;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.photoAvatarGroupVoices)
                            .values(__assign(__assign({}, insertVoice), { heygenAudioAssetId: insertVoice.heygenAudioAssetId || null }))
                            .returning()];
                    case 1:
                        voice = (_a.sent())[0];
                        return [2 /*return*/, voice];
                }
            });
        });
    };
    MemStorage.prototype.getPhotoAvatarGroupVoice = function (groupId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var voice;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.photoAvatarGroupVoices)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroupVoices.groupId, groupId), (0, drizzle_orm_1.eq)(schema_1.photoAvatarGroupVoices.userId, userId)))
                            .limit(1)];
                    case 1:
                        voice = (_a.sent())[0];
                        return [2 /*return*/, voice];
                }
            });
        });
    };
    MemStorage.prototype.listPhotoAvatarGroupVoices = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.photoAvatarGroupVoices)
                            .where((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroupVoices.userId, userId))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // Photo Avatar Groups
    MemStorage.prototype.createPhotoAvatarGroup = function (insertGroup) {
        return __awaiter(this, void 0, void 0, function () {
            var group;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.photoAvatarGroups)
                            .values(insertGroup)
                            .returning()];
                    case 1:
                        group = (_a.sent())[0];
                        return [2 /*return*/, group];
                }
            });
        });
    };
    MemStorage.prototype.getPhotoAvatarGroup = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var group;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.photoAvatarGroups)
                            .where((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.id, id))
                            .limit(1)];
                    case 1:
                        group = (_a.sent())[0];
                        return [2 /*return*/, group];
                }
            });
        });
    };
    MemStorage.prototype.getPhotoAvatarGroupByHeygenId = function (heygenGroupId) {
        return __awaiter(this, void 0, void 0, function () {
            var group;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.photoAvatarGroups)
                            .where((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.heygenGroupId, heygenGroupId))
                            .limit(1)];
                    case 1:
                        group = (_a.sent())[0];
                        return [2 /*return*/, group];
                }
            });
        });
    };
    MemStorage.prototype.getPhotoAvatarGroupByImageHash = function (imageHash, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var group;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.photoAvatarGroups)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.imageHash, imageHash), (0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.userId, userId)))
                            .limit(1)];
                    case 1:
                        group = (_a.sent())[0];
                        return [2 /*return*/, group];
                }
            });
        });
    };
    MemStorage.prototype.listPhotoAvatarGroups = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        console.log("\uD83D\uDCF8 [STORAGE] listPhotoAvatarGroups called with userId: \"".concat(userId, "\""));
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.photoAvatarGroups)
                                .where((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.userId, userId))];
                    case 1:
                        result = _a.sent();
                        console.log("\uD83D\uDCF8 [STORAGE] Found ".concat(result.length, " groups, group user_ids: ").concat(result.map(function (g) { return g.userId; }).join(', ')));
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.updatePhotoAvatarGroup = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.photoAvatarGroups)
                            .set(updates)
                            .where((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.getPhotoAvatarGroupByHeygenIdAndUser = function (heygenGroupId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var group;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.photoAvatarGroups)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.heygenGroupId, heygenGroupId), (0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.userId, userId)))
                            .limit(1)];
                    case 1:
                        group = (_a.sent())[0];
                        return [2 /*return*/, group];
                }
            });
        });
    };
    MemStorage.prototype.deletePhotoAvatarGroup = function (groupId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.photoAvatarGroups)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.heygenGroupId, groupId), (0, drizzle_orm_1.eq)(schema_1.photoAvatarGroups.userId, userId)))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rowCount ? result.rowCount > 0 : false];
                }
            });
        });
    };
    // Individual Photo Avatars
    MemStorage.prototype.createPhotoAvatar = function (avatar) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.photoAvatars).values(avatar).returning()];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.listPhotoAvatarsByGroup = function (groupId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.photoAvatars)
                            .where((0, drizzle_orm_1.eq)(schema_1.photoAvatars.groupId, groupId))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.listPhotoAvatarsByUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var results;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select({
                            id: schema_1.lookGenerationJobs.id,
                            groupId: schema_1.lookGenerationJobs.groupId,
                            photoUrl: schema_1.lookGenerationJobs.resultImageUrl,
                            lookLabel: schema_1.lookGenerationJobs.lookLabel,
                            lookName: schema_1.lookGenerationJobs.lookName,
                            prompt: schema_1.lookGenerationJobs.prompt,
                            status: schema_1.lookGenerationJobs.status,
                            createdAt: schema_1.lookGenerationJobs.createdAt,
                            groupName: schema_1.photoAvatarGroups.groupName,
                        })
                            .from(schema_1.lookGenerationJobs)
                            .leftJoin(schema_1.photoAvatarGroups, (0, drizzle_orm_1.eq)(schema_1.lookGenerationJobs.groupId, schema_1.photoAvatarGroups.heygenGroupId))
                            .where((0, drizzle_orm_1.eq)(schema_1.lookGenerationJobs.userId, userId))
                            .orderBy(schema_1.lookGenerationJobs.createdAt)];
                    case 1:
                        results = _a.sent();
                        return [2 /*return*/, results];
                }
            });
        });
    };
    MemStorage.prototype.getPhotoAvatarByHeygenIdAndUser = function (heygenAvatarId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var avatar;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.avatars)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.avatars.heygenAvatarId, heygenAvatarId), (0, drizzle_orm_1.eq)(schema_1.avatars.userId, userId)))
                            .limit(1)];
                    case 1:
                        avatar = (_a.sent())[0];
                        return [2 /*return*/, avatar];
                }
            });
        });
    };
    MemStorage.prototype.updatePhotoAvatar = function (heygenAvatarId, userId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.avatars)
                            .set(updates)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.avatars.heygenAvatarId, heygenAvatarId), (0, drizzle_orm_1.eq)(schema_1.avatars.userId, userId)))
                            .returning()];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.deletePhotoAvatar = function (heygenAvatarId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.avatars)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.avatars.heygenAvatarId, heygenAvatarId), (0, drizzle_orm_1.eq)(schema_1.avatars.userId, userId)))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rowCount ? result.rowCount > 0 : false];
                }
            });
        });
    };
    // Video Avatars (Enterprise HeyGen Feature)
    MemStorage.prototype.createVideoAvatar = function (avatar) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.videoAvatars).values(avatar).returning()];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.getVideoAvatar = function (userId, heygenAvatarId) {
        return __awaiter(this, void 0, void 0, function () {
            var avatar;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoAvatars)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.videoAvatars.heygenAvatarId, heygenAvatarId), (0, drizzle_orm_1.eq)(schema_1.videoAvatars.userId, userId)))
                            .limit(1)];
                    case 1:
                        avatar = (_a.sent())[0];
                        return [2 /*return*/, avatar];
                }
            });
        });
    };
    MemStorage.prototype.listVideoAvatars = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoAvatars)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoAvatars.userId, userId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.videoAvatars.createdAt))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.updateVideoAvatarStatus = function (userId, heygenAvatarId, status, errorMessage) {
        return __awaiter(this, void 0, void 0, function () {
            var updates, result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        updates = {
                            status: status,
                            errorMessage: errorMessage || null,
                        };
                        if (status === "complete") {
                            updates.completedAt = new Date();
                        }
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.videoAvatars)
                                .set(updates)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.videoAvatars.heygenAvatarId, heygenAvatarId), (0, drizzle_orm_1.eq)(schema_1.videoAvatars.userId, userId)))
                                .returning()];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.deleteVideoAvatar = function (userId, heygenAvatarId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.videoAvatars)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.videoAvatars.heygenAvatarId, heygenAvatarId), (0, drizzle_orm_1.eq)(schema_1.videoAvatars.userId, userId)))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.rowCount ? result.rowCount > 0 : false];
                }
            });
        });
    };
    MemStorage.prototype.getCompanyProfile = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var profile;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.companyProfiles)
                            .where((0, drizzle_orm_1.eq)(schema_1.companyProfiles.userId, userId))
                            .limit(1)];
                    case 1:
                        profile = (_a.sent())[0];
                        return [2 /*return*/, profile || null];
                }
            });
        });
    };
    MemStorage.prototype.upsertCompanyProfile = function (profile) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.companyProfiles)
                            .values(profile)
                            .onConflictDoUpdate({
                            target: schema_1.companyProfiles.userId,
                            set: __assign(__assign({}, profile), { updatedAt: new Date() }),
                        })
                            .returning()];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.getBrandSettings = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var settings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.brandSettings)
                            .where((0, drizzle_orm_1.eq)(schema_1.brandSettings.userId, userId))
                            .limit(1)];
                    case 1:
                        settings = (_a.sent())[0];
                        return [2 /*return*/, settings || null];
                }
            });
        });
    };
    MemStorage.prototype.upsertBrandSettings = function (settings) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.brandSettings)
                            .values(settings)
                            .onConflictDoUpdate({
                            target: schema_1.brandSettings.userId,
                            set: __assign(__assign({}, settings), { updatedAt: new Date() }),
                        })
                            .returning()];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.getMediaAssets = function (userId, type, source) {
        return __awaiter(this, void 0, void 0, function () {
            var conditions, assets;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        conditions = [(0, drizzle_orm_1.eq)(schema_1.mediaAssets.userId, userId)];
                        if (type) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.mediaAssets.type, type));
                        }
                        if (source) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.mediaAssets.source, source));
                        }
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.mediaAssets)
                                .where(conditions.length === 1 ? conditions[0] : drizzle_orm_1.and.apply(void 0, conditions))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.mediaAssets.createdAt))];
                    case 1:
                        assets = _a.sent();
                        return [2 /*return*/, assets];
                }
            });
        });
    };
    MemStorage.prototype.getMediaAssetById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var asset;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.mediaAssets)
                            .where((0, drizzle_orm_1.eq)(schema_1.mediaAssets.id, id))
                            .limit(1)];
                    case 1:
                        asset = (_a.sent())[0];
                        return [2 /*return*/, asset];
                }
            });
        });
    };
    MemStorage.prototype.createMediaAsset = function (asset) {
        return __awaiter(this, void 0, void 0, function () {
            var newAsset;
            var _a, _b, _c;
            return __generator(this, function (_d) {
                switch (_d.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.mediaAssets)
                            .values(__assign(__assign({ id: (0, crypto_1.randomUUID)() }, asset), { title: (_a = asset.title) !== null && _a !== void 0 ? _a : null, description: (_b = asset.description) !== null && _b !== void 0 ? _b : null, metadata: (_c = asset.metadata) !== null && _c !== void 0 ? _c : null, createdAt: new Date() }))
                            .returning()];
                    case 1:
                        newAsset = (_d.sent())[0];
                        return [2 /*return*/, newAsset];
                }
            });
        });
    };
    MemStorage.prototype.updateMediaAsset = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.mediaAssets)
                            .set(updates)
                            .where((0, drizzle_orm_1.eq)(schema_1.mediaAssets.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.deleteMediaAsset = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.mediaAssets)
                            .where((0, drizzle_orm_1.eq)(schema_1.mediaAssets.id, id))
                            .returning()];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, result.length > 0];
                }
            });
        });
    };
    MemStorage.prototype.createPostMedia = function (postMedias) {
        return __awaiter(this, void 0, void 0, function () {
            var results, _i, postMedias_1, pm, newPostMedia;
            var _a;
            return __generator(this, function (_b) {
                results = [];
                for (_i = 0, postMedias_1 = postMedias; _i < postMedias_1.length; _i++) {
                    pm = postMedias_1[_i];
                    newPostMedia = __assign(__assign({ id: (0, crypto_1.randomUUID)() }, pm), { orderIndex: (_a = pm.orderIndex) !== null && _a !== void 0 ? _a : null, createdAt: new Date() });
                    this.postMedia.set(newPostMedia.id, newPostMedia);
                    results.push(newPostMedia);
                }
                return [2 /*return*/, results];
            });
        });
    };
    MemStorage.prototype.getPostMedia = function (postId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, Array.from(this.postMedia.values())
                        .filter(function (pm) { return pm.postId === postId; })
                        .sort(function (a, b) { return (a.orderIndex || 0) - (b.orderIndex || 0); })];
            });
        });
    };
    MemStorage.prototype.createMobileUploadSession = function (userId, type) {
        return __awaiter(this, void 0, void 0, function () {
            var nanoid, sessionId, now, expiresAt, session;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("nanoid"); })];
                    case 1:
                        nanoid = (_a.sent()).nanoid;
                        sessionId = nanoid();
                        now = new Date();
                        expiresAt = new Date(now.getTime() + 15 * 60 * 1000);
                        session = {
                            id: sessionId,
                            userId: userId,
                            type: type,
                            createdAt: now,
                            expiresAt: expiresAt,
                            uploadedUrl: null,
                        };
                        this.mobileUploadSessions.set(sessionId, session);
                        return [2 /*return*/, { sessionId: sessionId }];
                }
            });
        });
    };
    MemStorage.prototype.getMobileUploadSession = function (sessionId) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                session = this.mobileUploadSessions.get(sessionId);
                if (!session)
                    return [2 /*return*/, null];
                // Check if session is expired
                if (new Date() > session.expiresAt) {
                    this.mobileUploadSessions.delete(sessionId);
                    return [2 /*return*/, null];
                }
                return [2 /*return*/, session];
            });
        });
    };
    MemStorage.prototype.updateMobileUploadSession = function (sessionId, uploadedUrl) {
        return __awaiter(this, void 0, void 0, function () {
            var session;
            return __generator(this, function (_a) {
                session = this.mobileUploadSessions.get(sessionId);
                if (session) {
                    session.uploadedUrl = uploadedUrl;
                    this.mobileUploadSessions.set(sessionId, session);
                }
                return [2 /*return*/];
            });
        });
    };
    // Event Sources implementation
    MemStorage.prototype.getEventSources = function (userId, businessType) {
        return __awaiter(this, void 0, void 0, function () {
            var conditions;
            return __generator(this, function (_a) {
                conditions = [(0, drizzle_orm_1.eq)(schema_1.eventSources.userId, userId)];
                if (businessType) {
                    conditions.push((0, drizzle_orm_1.eq)(schema_1.eventSources.businessType, businessType));
                }
                return [2 /*return*/, db_1.db
                        .select()
                        .from(schema_1.eventSources)
                        .where(drizzle_orm_1.and.apply(void 0, conditions))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.eventSources.createdAt))];
            });
        });
    };
    MemStorage.prototype.getEventSourceById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var source;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.eventSources)
                            .where((0, drizzle_orm_1.eq)(schema_1.eventSources.id, id))];
                    case 1:
                        source = (_a.sent())[0];
                        return [2 /*return*/, source];
                }
            });
        });
    };
    MemStorage.prototype.createEventSource = function (source) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.eventSources)
                            .values(source)
                            .returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.updateEventSource = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.eventSources)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.eventSources.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.deleteEventSource = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.eventSources)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.eventSources.id, id), (0, drizzle_orm_1.eq)(schema_1.eventSources.userId, userId)))];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result.rowCount) !== null && _a !== void 0 ? _a : 0) > 0];
                }
            });
        });
    };
    // Events implementation
    MemStorage.prototype.getEvents = function (userId, options) {
        return __awaiter(this, void 0, void 0, function () {
            var _a, gte, lte, conditions;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, Promise.resolve().then(function () { return require("drizzle-orm"); })];
                    case 1:
                        _a = _b.sent(), gte = _a.gte, lte = _a.lte;
                        conditions = [(0, drizzle_orm_1.eq)(schema_1.events.userId, userId)];
                        if (options === null || options === void 0 ? void 0 : options.businessType) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.events.businessType, options.businessType));
                        }
                        if (options === null || options === void 0 ? void 0 : options.startDate) {
                            conditions.push(gte(schema_1.events.startTime, options.startDate));
                        }
                        if (options === null || options === void 0 ? void 0 : options.endDate) {
                            conditions.push(lte(schema_1.events.startTime, options.endDate));
                        }
                        if (options === null || options === void 0 ? void 0 : options.sourceId) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.events.sourceId, options.sourceId));
                        }
                        if (options === null || options === void 0 ? void 0 : options.category) {
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.events.category, options.category));
                        }
                        return [2 /*return*/, db_1.db
                                .select()
                                .from(schema_1.events)
                                .where(drizzle_orm_1.and.apply(void 0, conditions))
                                .orderBy(schema_1.events.startTime)];
                }
            });
        });
    };
    MemStorage.prototype.getEventById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var event;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.events)
                            .where((0, drizzle_orm_1.eq)(schema_1.events.id, id))];
                    case 1:
                        event = (_a.sent())[0];
                        return [2 /*return*/, event];
                }
            });
        });
    };
    MemStorage.prototype.getEventByExternalId = function (userId, sourceId, externalId) {
        return __awaiter(this, void 0, void 0, function () {
            var event;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.events)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.events.userId, userId), (0, drizzle_orm_1.eq)(schema_1.events.sourceId, sourceId), (0, drizzle_orm_1.eq)(schema_1.events.externalId, externalId)))];
                    case 1:
                        event = (_a.sent())[0];
                        return [2 /*return*/, event];
                }
            });
        });
    };
    MemStorage.prototype.createEvent = function (event) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.events)
                            .values(event)
                            .returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.updateEvent = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.events)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.events.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.deleteEvent = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.events)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.events.id, id), (0, drizzle_orm_1.eq)(schema_1.events.userId, userId)))];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result.rowCount) !== null && _a !== void 0 ? _a : 0) > 0];
                }
            });
        });
    };
    MemStorage.prototype.deleteEventsBySource = function (sourceId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.events)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.events.sourceId, sourceId), (0, drizzle_orm_1.eq)(schema_1.events.userId, userId)))];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, (_a = result.rowCount) !== null && _a !== void 0 ? _a : 0];
                }
            });
        });
    };
    // Event Post Suggestions implementation
    MemStorage.prototype.getEventPostSuggestions = function (userId, eventId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                if (eventId) {
                    return [2 /*return*/, db_1.db
                            .select()
                            .from(schema_1.eventPostSuggestions)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.eventPostSuggestions.userId, userId), (0, drizzle_orm_1.eq)(schema_1.eventPostSuggestions.eventId, eventId)))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.eventPostSuggestions.createdAt))];
                }
                return [2 /*return*/, db_1.db
                        .select()
                        .from(schema_1.eventPostSuggestions)
                        .where((0, drizzle_orm_1.eq)(schema_1.eventPostSuggestions.userId, userId))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.eventPostSuggestions.createdAt))];
            });
        });
    };
    MemStorage.prototype.createEventPostSuggestion = function (suggestion) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.eventPostSuggestions)
                            .values(suggestion)
                            .returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.updateEventPostSuggestion = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.eventPostSuggestions)
                            .set(updates)
                            .where((0, drizzle_orm_1.eq)(schema_1.eventPostSuggestions.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.deleteEventPostSuggestion = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.eventPostSuggestions)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.eventPostSuggestions.id, id), (0, drizzle_orm_1.eq)(schema_1.eventPostSuggestions.userId, userId)))];
                    case 1:
                        result = _b.sent();
                        return [2 /*return*/, ((_a = result.rowCount) !== null && _a !== void 0 ? _a : 0) > 0];
                }
            });
        });
    };
    // Compliance Settings implementation
    MemStorage.prototype.getComplianceSettings = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var settings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.complianceSettings)
                            .where((0, drizzle_orm_1.eq)(schema_1.complianceSettings.userId, userId))];
                    case 1:
                        settings = (_a.sent())[0];
                        return [2 /*return*/, settings];
                }
            });
        });
    };
    MemStorage.prototype.createComplianceSettings = function (settings) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.complianceSettings)
                            .values(settings)
                            .returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.updateComplianceSettings = function (userId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.complianceSettings)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.complianceSettings.userId, userId))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    // Video Templates
    MemStorage.prototype.getVideoTemplates = function () {
        return __awaiter(this, arguments, void 0, function (activeOnly) {
            if (activeOnly === void 0) { activeOnly = true; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (!activeOnly) return [3 /*break*/, 2];
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.videoTemplates)
                                .where((0, drizzle_orm_1.eq)(schema_1.videoTemplates.isActive, true))
                                .orderBy(schema_1.videoTemplates.sortOrder)];
                    case 1: return [2 /*return*/, _a.sent()];
                    case 2: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoTemplates)
                            .orderBy(schema_1.videoTemplates.sortOrder)];
                    case 3: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getVideoTemplateById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var template;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoTemplates)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoTemplates.id, id))];
                    case 1:
                        template = (_a.sent())[0];
                        return [2 /*return*/, template];
                }
            });
        });
    };
    MemStorage.prototype.getVideoTemplateBySlug = function (slug) {
        return __awaiter(this, void 0, void 0, function () {
            var template;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoTemplates)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoTemplates.slug, slug))];
                    case 1:
                        template = (_a.sent())[0];
                        return [2 /*return*/, template];
                }
            });
        });
    };
    MemStorage.prototype.createVideoTemplate = function (template) {
        return __awaiter(this, void 0, void 0, function () {
            var newTemplate;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.videoTemplates)
                            .values(template)
                            .returning()];
                    case 1:
                        newTemplate = (_a.sent())[0];
                        return [2 /*return*/, newTemplate];
                }
            });
        });
    };
    MemStorage.prototype.updateVideoTemplate = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.videoTemplates)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.videoTemplates.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    // Template Variables
    MemStorage.prototype.getTemplateVariables = function (templateId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.templateVariables)
                            .where((0, drizzle_orm_1.eq)(schema_1.templateVariables.templateId, templateId))
                            .orderBy(schema_1.templateVariables.orderIndex)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.createTemplateVariables = function (variables) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (variables.length === 0)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, db_1.db
                                .insert(schema_1.templateVariables)
                                .values(variables)
                                .returning()];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // Generated Videos
    MemStorage.prototype.getGeneratedVideos = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.generatedVideos)
                            .where((0, drizzle_orm_1.eq)(schema_1.generatedVideos.userId, userId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.generatedVideos.createdAt))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getGeneratedVideoById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var video;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.generatedVideos)
                            .where((0, drizzle_orm_1.eq)(schema_1.generatedVideos.id, id))];
                    case 1:
                        video = (_a.sent())[0];
                        return [2 /*return*/, video];
                }
            });
        });
    };
    MemStorage.prototype.createGeneratedVideo = function (video) {
        return __awaiter(this, void 0, void 0, function () {
            var newVideo;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.generatedVideos)
                            .values(video)
                            .returning()];
                    case 1:
                        newVideo = (_a.sent())[0];
                        return [2 /*return*/, newVideo];
                }
            });
        });
    };
    MemStorage.prototype.updateGeneratedVideo = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.generatedVideos)
                            .set(updates)
                            .where((0, drizzle_orm_1.eq)(schema_1.generatedVideos.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    // Look Generation Jobs
    MemStorage.prototype.createLookGenerationJob = function (job) {
        return __awaiter(this, void 0, void 0, function () {
            var newJob;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.lookGenerationJobs)
                            .values(job)
                            .returning()];
                    case 1:
                        newJob = (_a.sent())[0];
                        return [2 /*return*/, newJob];
                }
            });
        });
    };
    MemStorage.prototype.getLookGenerationJobsByGroup = function (groupId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.lookGenerationJobs)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.lookGenerationJobs.groupId, groupId), (0, drizzle_orm_1.eq)(schema_1.lookGenerationJobs.userId, userId)))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.lookGenerationJobs.createdAt))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.updateLookGenerationJob = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.lookGenerationJobs)
                            .set(updates)
                            .where((0, drizzle_orm_1.eq)(schema_1.lookGenerationJobs.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.getPendingLookGenerationJobs = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.lookGenerationJobs)
                            .where((0, drizzle_orm_1.eq)(schema_1.lookGenerationJobs.status, "pending"))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // Video Generation Jobs (Background Processing)
    MemStorage.prototype.createVideoGenerationJob = function (job) {
        return __awaiter(this, void 0, void 0, function () {
            var newJob;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.videoGenerationJobs)
                            .values(job)
                            .returning()];
                    case 1:
                        newJob = (_a.sent())[0];
                        return [2 /*return*/, newJob];
                }
            });
        });
    };
    MemStorage.prototype.getVideoGenerationJob = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var job;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoGenerationJobs)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoGenerationJobs.id, id))];
                    case 1:
                        job = (_a.sent())[0];
                        return [2 /*return*/, job];
                }
            });
        });
    };
    MemStorage.prototype.getVideoGenerationJobsByUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoGenerationJobs)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoGenerationJobs.userId, userId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.videoGenerationJobs.createdAt))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getPendingVideoGenerationJobs = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoGenerationJobs)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoGenerationJobs.status, "pending"))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getProcessingVideoGenerationJobs = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.videoGenerationJobs)
                            .where((0, drizzle_orm_1.eq)(schema_1.videoGenerationJobs.status, "processing"))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.updateVideoGenerationJob = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.videoGenerationJobs)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.videoGenerationJobs.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    // Twilio Settings
    MemStorage.prototype.getTwilioSettingsByUserId = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var settings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.twilioSettings)
                            .where((0, drizzle_orm_1.eq)(schema_1.twilioSettings.userId, userId))];
                    case 1:
                        settings = (_a.sent())[0];
                        return [2 /*return*/, settings];
                }
            });
        });
    };
    MemStorage.prototype.getTwilioSettingsByPhoneNumber = function (phoneNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var settings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.twilioSettings)
                            .where((0, drizzle_orm_1.eq)(schema_1.twilioSettings.phoneNumber, phoneNumber))];
                    case 1:
                        settings = (_a.sent())[0];
                        return [2 /*return*/, settings];
                }
            });
        });
    };
    MemStorage.prototype.createOrUpdateTwilioSettings = function (settings) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.twilioSettings)
                            .values(settings)
                            .onConflictDoUpdate({
                            target: schema_1.twilioSettings.userId,
                            set: __assign(__assign({}, settings), { updatedAt: new Date() }),
                        })
                            .returning()];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result];
                }
            });
        });
    };
    // Twilio Conversations
    MemStorage.prototype.getTwilioConversationByPhone = function (userId, fromNumber) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.twilioConversations)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.twilioConversations.userId, userId), (0, drizzle_orm_1.eq)(schema_1.twilioConversations.fromNumber, fromNumber)))];
                    case 1:
                        conversation = (_a.sent())[0];
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    MemStorage.prototype.createTwilioConversation = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.twilioConversations)
                            .values(data)
                            .returning()];
                    case 1:
                        conversation = (_a.sent())[0];
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    MemStorage.prototype.updateTwilioConversation = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.twilioConversations)
                            .set(updates)
                            .where((0, drizzle_orm_1.eq)(schema_1.twilioConversations.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.getTwilioConversationsByUserId = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.twilioConversations)
                            .where((0, drizzle_orm_1.eq)(schema_1.twilioConversations.userId, userId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.twilioConversations.lastMessageAt))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getTwilioConversationById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.twilioConversations)
                            .where((0, drizzle_orm_1.eq)(schema_1.twilioConversations.id, id))];
                    case 1:
                        conversation = (_a.sent())[0];
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    // Twilio Messages
    MemStorage.prototype.createTwilioMessage = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.twilioMessages)
                            .values(data)
                            .returning()];
                    case 1:
                        message = (_a.sent())[0];
                        return [2 /*return*/, message];
                }
            });
        });
    };
    MemStorage.prototype.getTwilioMessagesByConversationId = function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.twilioMessages)
                            .where((0, drizzle_orm_1.eq)(schema_1.twilioMessages.conversationId, conversationId))
                            .orderBy(schema_1.twilioMessages.createdAt)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    // WhatsApp Settings
    MemStorage.prototype.getWhatsappSettingsByUserId = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var settings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappSettings)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappSettings.userId, userId))];
                    case 1:
                        settings = (_a.sent())[0];
                        return [2 /*return*/, settings];
                }
            });
        });
    };
    MemStorage.prototype.getWhatsappSettingsByPhoneNumberId = function (phoneNumberId) {
        return __awaiter(this, void 0, void 0, function () {
            var settings;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappSettings)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappSettings.phoneNumberId, phoneNumberId))];
                    case 1:
                        settings = (_a.sent())[0];
                        return [2 /*return*/, settings];
                }
            });
        });
    };
    MemStorage.prototype.createOrUpdateWhatsappSettings = function (settings) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.whatsappSettings)
                            .values(settings)
                            .onConflictDoUpdate({
                            target: schema_1.whatsappSettings.userId,
                            set: __assign(__assign({}, settings), { updatedAt: new Date() }),
                        })
                            .returning()];
                    case 1:
                        result = (_a.sent())[0];
                        return [2 /*return*/, result];
                }
            });
        });
    };
    // WhatsApp Conversations
    MemStorage.prototype.getWhatsappConversationByWaId = function (userId, waId) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappConversations)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.whatsappConversations.userId, userId), (0, drizzle_orm_1.eq)(schema_1.whatsappConversations.waId, waId)))];
                    case 1:
                        conversation = (_a.sent())[0];
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    MemStorage.prototype.createWhatsappConversation = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.whatsappConversations)
                            .values(data)
                            .returning()];
                    case 1:
                        conversation = (_a.sent())[0];
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    MemStorage.prototype.updateWhatsappConversation = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.whatsappConversations)
                            .set(updates)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappConversations.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.getWhatsappConversationsByUserId = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappConversations)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappConversations.userId, userId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.whatsappConversations.lastMessageAt))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getWhatsappConversationById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var conversation;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappConversations)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappConversations.id, id))];
                    case 1:
                        conversation = (_a.sent())[0];
                        return [2 /*return*/, conversation];
                }
            });
        });
    };
    // WhatsApp Messages
    MemStorage.prototype.createWhatsappMessage = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var message;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.whatsappMessages)
                            .values(data)
                            .returning()];
                    case 1:
                        message = (_a.sent())[0];
                        return [2 /*return*/, message];
                }
            });
        });
    };
    MemStorage.prototype.getWhatsappMessagesByConversationId = function (conversationId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappMessages)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappMessages.conversationId, conversationId))
                            .orderBy(schema_1.whatsappMessages.createdAt)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getMenuItems = function (userId, businessType) {
        return __awaiter(this, void 0, void 0, function () {
            var conditions;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        conditions = [(0, drizzle_orm_1.eq)(schema_1.menuItems.userId, userId)];
                        if (businessType)
                            conditions.push((0, drizzle_orm_1.eq)(schema_1.menuItems.businessType, businessType));
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.menuItems)
                                .where(drizzle_orm_1.and.apply(void 0, conditions))
                                .orderBy(schema_1.menuItems.sortOrder, schema_1.menuItems.createdAt)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getMenuItemById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var item;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.menuItems).where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))];
                    case 1:
                        item = (_a.sent())[0];
                        return [2 /*return*/, item];
                }
            });
        });
    };
    MemStorage.prototype.createMenuItem = function (item) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.menuItems).values(item).returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.updateMenuItem = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.menuItems)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.deleteMenuItem = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.delete(schema_1.menuItems).where((0, drizzle_orm_1.eq)(schema_1.menuItems.id, id))];
                    case 1:
                        result = _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    MemStorage.prototype.getBusinessLocations = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.businessLocations)
                            .where((0, drizzle_orm_1.eq)(schema_1.businessLocations.userId, userId))
                            .orderBy(schema_1.businessLocations.isPrimary, schema_1.businessLocations.createdAt)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getBusinessLocationById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var location;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.businessLocations).where((0, drizzle_orm_1.eq)(schema_1.businessLocations.id, id))];
                    case 1:
                        location = (_a.sent())[0];
                        return [2 /*return*/, location];
                }
            });
        });
    };
    MemStorage.prototype.createBusinessLocation = function (location) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.businessLocations).values(location).returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.updateBusinessLocation = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.businessLocations)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.businessLocations.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.deleteBusinessLocation = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.delete(schema_1.businessLocations).where((0, drizzle_orm_1.eq)(schema_1.businessLocations.id, id))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/, true];
                }
            });
        });
    };
    MemStorage.prototype.createWhatsappBulkQueue = function (data) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.whatsappBulkQueues).values(data).returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.getWhatsappBulkQueuesByUserId = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappBulkQueues)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappBulkQueues.userId, userId))
                            .orderBy((0, drizzle_orm_1.sql)(templateObject_3 || (templateObject_3 = __makeTemplateObject(["created_at DESC"], ["created_at DESC"]))))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getWhatsappBulkQueueById = function (id) {
        return __awaiter(this, void 0, void 0, function () {
            var queue;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.select().from(schema_1.whatsappBulkQueues).where((0, drizzle_orm_1.eq)(schema_1.whatsappBulkQueues.id, id))];
                    case 1:
                        queue = (_a.sent())[0];
                        return [2 /*return*/, queue];
                }
            });
        });
    };
    MemStorage.prototype.updateWhatsappBulkQueue = function (id, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.whatsappBulkQueues)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappBulkQueues.id, id))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.getActiveWhatsappBulkQueues = function () {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappBulkQueues)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappBulkQueues.status, "active"))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.saveWhatsappBulkSendResult = function (userId, data) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, updated, created;
            var _a, _b, _c, _d, _e, _f, _g, _h, _j, _k, _l, _m, _o, _p, _q, _r, _s, _t;
            return __generator(this, function (_u) {
                switch (_u.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappBulkSendResults)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappBulkSendResults.userId, userId))
                            .orderBy((0, drizzle_orm_1.sql)(templateObject_4 || (templateObject_4 = __makeTemplateObject(["created_at DESC"], ["created_at DESC"]))))
                            .limit(1)];
                    case 1:
                        existing = _u.sent();
                        if (!(existing.length > 0 && !existing[0].complete)) return [3 /*break*/, 3];
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.whatsappBulkSendResults)
                                .set({
                                sent: (_a = data.sent) !== null && _a !== void 0 ? _a : 0,
                                failed: (_b = data.failed) !== null && _b !== void 0 ? _b : 0,
                                total: (_c = data.total) !== null && _c !== void 0 ? _c : 0,
                                queued: (_d = data.queued) !== null && _d !== void 0 ? _d : 0,
                                percent: (_e = data.percent) !== null && _e !== void 0 ? _e : 0,
                                elapsed: (_f = data.elapsed) !== null && _f !== void 0 ? _f : 0,
                                estimatedCost: data.estimatedCost ? String(data.estimatedCost) : null,
                                errorBreakdown: data.errorBreakdown ? JSON.stringify(data.errorBreakdown) : null,
                                complete: (_g = data.complete) !== null && _g !== void 0 ? _g : false,
                                message: (_h = data.message) !== null && _h !== void 0 ? _h : null,
                                bulkQueueId: (_j = data.bulkQueueId) !== null && _j !== void 0 ? _j : null,
                                updatedAt: new Date(),
                            })
                                .where((0, drizzle_orm_1.eq)(schema_1.whatsappBulkSendResults.id, existing[0].id))
                                .returning()];
                    case 2:
                        updated = (_u.sent())[0];
                        return [2 /*return*/, updated];
                    case 3: return [4 /*yield*/, db_1.db
                            .insert(schema_1.whatsappBulkSendResults)
                            .values({
                            userId: userId,
                            sent: (_k = data.sent) !== null && _k !== void 0 ? _k : 0,
                            failed: (_l = data.failed) !== null && _l !== void 0 ? _l : 0,
                            total: (_m = data.total) !== null && _m !== void 0 ? _m : 0,
                            queued: (_o = data.queued) !== null && _o !== void 0 ? _o : 0,
                            percent: (_p = data.percent) !== null && _p !== void 0 ? _p : 0,
                            elapsed: (_q = data.elapsed) !== null && _q !== void 0 ? _q : 0,
                            estimatedCost: data.estimatedCost ? String(data.estimatedCost) : null,
                            errorBreakdown: data.errorBreakdown ? JSON.stringify(data.errorBreakdown) : null,
                            complete: (_r = data.complete) !== null && _r !== void 0 ? _r : false,
                            message: (_s = data.message) !== null && _s !== void 0 ? _s : null,
                            bulkQueueId: (_t = data.bulkQueueId) !== null && _t !== void 0 ? _t : null,
                        })
                            .returning()];
                    case 4:
                        created = (_u.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.getLatestWhatsappBulkSendResult = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var result;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.whatsappBulkSendResults)
                            .where((0, drizzle_orm_1.eq)(schema_1.whatsappBulkSendResults.userId, userId))
                            .orderBy((0, drizzle_orm_1.sql)(templateObject_5 || (templateObject_5 = __makeTemplateObject(["created_at DESC"], ["created_at DESC"]))))
                            .limit(1)];
                    case 1:
                        result = (_a.sent())[0];
                        if (!result)
                            return [2 /*return*/, null];
                        return [2 /*return*/, __assign(__assign({}, result), { errorBreakdown: result.errorBreakdown ? JSON.parse(result.errorBreakdown) : null, estimatedCost: result.estimatedCost ? parseFloat(result.estimatedCost) : 0 })];
                }
            });
        });
    };
    // ============== Boards ==============
    MemStorage.prototype.getBoardsByUserId = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.boards)
                            .where((0, drizzle_orm_1.eq)(schema_1.boards.userId, userId))
                            .orderBy((0, drizzle_orm_1.desc)(schema_1.boards.updatedAt))];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.resolveShareRecipientIdsForUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var ids, email, agent, numericId, publicUser;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        ids = new Set([userId]);
                        return [4 /*yield*/, db_1.db
                                .select({ email: schema_1.users.email })
                                .from(schema_1.users)
                                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                                .limit(1)];
                    case 1:
                        agent = (_a.sent())[0];
                        if (!(agent === null || agent === void 0 ? void 0 : agent.email)) return [3 /*break*/, 2];
                        email = agent.email;
                        return [3 /*break*/, 4];
                    case 2:
                        numericId = Number(userId);
                        if (!(Number.isInteger(numericId) && numericId > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, db_1.db
                                .select({ email: schema_1.publicUsers.email })
                                .from(schema_1.publicUsers)
                                .where((0, drizzle_orm_1.eq)(schema_1.publicUsers.id, numericId))
                                .limit(1)];
                    case 3:
                        publicUser = (_a.sent())[0];
                        if (publicUser === null || publicUser === void 0 ? void 0 : publicUser.email)
                            email = publicUser.email;
                        _a.label = 4;
                    case 4:
                        if (email)
                            ids.add(emailShareIdFromEmail(email));
                        return [2 /*return*/, Array.from(ids)];
                }
            });
        });
    };
    MemStorage.prototype.getAccessibleBoardsForUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var recipientIds, owned, sharedRows, _a, seen, merged, _i, sharedRows_1, r;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, this.resolveShareRecipientIdsForUser(userId)];
                    case 1:
                        recipientIds = _b.sent();
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.boards)
                                .where((0, drizzle_orm_1.eq)(schema_1.boards.userId, userId))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.boards.updatedAt))];
                    case 2:
                        owned = _b.sent();
                        if (!(recipientIds.length > 0)) return [3 /*break*/, 4];
                        return [4 /*yield*/, db_1.db
                                .select({ board: schema_1.boards })
                                .from(schema_1.boardShares)
                                .innerJoin(schema_1.boards, (0, drizzle_orm_1.eq)(schema_1.boards.id, schema_1.boardShares.boardId))
                                .where((0, drizzle_orm_1.inArray)(schema_1.boardShares.sharedWithUserId, recipientIds))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.boards.updatedAt))];
                    case 3:
                        _a = _b.sent();
                        return [3 /*break*/, 5];
                    case 4:
                        _a = [];
                        _b.label = 5;
                    case 5:
                        sharedRows = _a;
                        seen = new Set(owned.map(function (b) { return b.id; }));
                        merged = owned.map(function (b) { return (__assign(__assign({}, b), { isOwner: true })); });
                        for (_i = 0, sharedRows_1 = sharedRows; _i < sharedRows_1.length; _i++) {
                            r = sharedRows_1[_i];
                            if (seen.has(r.board.id))
                                continue;
                            seen.add(r.board.id);
                            merged.push(__assign(__assign({}, r.board), { isOwner: false }));
                        }
                        merged.sort(function (a, b) {
                            var ta = a.updatedAt ? a.updatedAt.getTime() : 0;
                            var tb = b.updatedAt ? b.updatedAt.getTime() : 0;
                            return tb - ta;
                        });
                        return [2 /*return*/, merged];
                }
            });
        });
    };
    MemStorage.prototype.getBoardByIdForUser = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var board;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select()
                            .from(schema_1.boards)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boards.id, id), (0, drizzle_orm_1.eq)(schema_1.boards.userId, userId)))];
                    case 1:
                        board = (_a.sent())[0];
                        return [2 /*return*/, board];
                }
            });
        });
    };
    MemStorage.prototype.getAccessibleBoardForUser = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var owned, recipientIds, row;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getBoardByIdForUser(id, userId)];
                    case 1:
                        owned = _a.sent();
                        if (owned)
                            return [2 /*return*/, __assign(__assign({}, owned), { isOwner: true })];
                        return [4 /*yield*/, this.resolveShareRecipientIdsForUser(userId)];
                    case 2:
                        recipientIds = _a.sent();
                        if (recipientIds.length === 0)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, db_1.db
                                .select({ board: schema_1.boards })
                                .from(schema_1.boardShares)
                                .innerJoin(schema_1.boards, (0, drizzle_orm_1.eq)(schema_1.boards.id, schema_1.boardShares.boardId))
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardShares.boardId, id), (0, drizzle_orm_1.inArray)(schema_1.boardShares.sharedWithUserId, recipientIds)))];
                    case 3:
                        row = (_a.sent())[0];
                        return [2 /*return*/, row ? __assign(__assign({}, row.board), { isOwner: false }) : undefined];
                }
            });
        });
    };
    MemStorage.prototype.getBoardShares = function (boardId, ownerUserId) {
        return __awaiter(this, void 0, void 0, function () {
            var owner, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getBoardByIdForUser(boardId, ownerUserId)];
                    case 1:
                        owner = _a.sent();
                        if (!owner)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, db_1.db
                                .select({
                                userId: schema_1.boardShares.sharedWithUserId,
                                sharedAt: schema_1.boardShares.createdAt,
                                userName: schema_1.users.name,
                                userEmail: schema_1.users.email,
                            })
                                .from(schema_1.boardShares)
                                .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.boardShares.sharedWithUserId))
                                .where((0, drizzle_orm_1.eq)(schema_1.boardShares.boardId, boardId))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.boardShares.createdAt))];
                    case 2:
                        rows = _a.sent();
                        return [2 /*return*/, rows.map(function (r) {
                                var _a, _b, _c;
                                return ({
                                    userId: r.userId,
                                    name: (_a = r.userName) !== null && _a !== void 0 ? _a : null,
                                    email: (_b = r.userEmail) !== null && _b !== void 0 ? _b : parseEmailFromShareRecipientId(r.userId),
                                    sharedAt: (_c = r.sharedAt) !== null && _c !== void 0 ? _c : null,
                                });
                            })];
                }
            });
        });
    };
    MemStorage.prototype.getBoardSharesForBoards = function (boardIds) {
        return __awaiter(this, void 0, void 0, function () {
            var result, unique, _i, unique_2, id, rows, _a, rows_2, r, list;
            var _b, _c, _d, _e;
            return __generator(this, function (_f) {
                switch (_f.label) {
                    case 0:
                        result = new Map();
                        if (!boardIds.length)
                            return [2 /*return*/, result];
                        unique = Array.from(new Set(boardIds));
                        for (_i = 0, unique_2 = unique; _i < unique_2.length; _i++) {
                            id = unique_2[_i];
                            result.set(id, []);
                        }
                        return [4 /*yield*/, db_1.db
                                .select({
                                boardId: schema_1.boardShares.boardId,
                                userId: schema_1.boardShares.sharedWithUserId,
                                sharedAt: schema_1.boardShares.createdAt,
                                userName: schema_1.users.name,
                                userEmail: schema_1.users.email,
                            })
                                .from(schema_1.boardShares)
                                .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.boardShares.sharedWithUserId))
                                .where((0, drizzle_orm_1.inArray)(schema_1.boardShares.boardId, unique))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.boardShares.createdAt))];
                    case 1:
                        rows = _f.sent();
                        for (_a = 0, rows_2 = rows; _a < rows_2.length; _a++) {
                            r = rows_2[_a];
                            list = (_b = result.get(r.boardId)) !== null && _b !== void 0 ? _b : [];
                            list.push({
                                userId: r.userId,
                                name: (_c = r.userName) !== null && _c !== void 0 ? _c : null,
                                email: (_d = r.userEmail) !== null && _d !== void 0 ? _d : parseEmailFromShareRecipientId(r.userId),
                                sharedAt: (_e = r.sharedAt) !== null && _e !== void 0 ? _e : null,
                            });
                            result.set(r.boardId, list);
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.shareBoard = function (boardId, ownerUserId, sharedWithUserId) {
        return __awaiter(this, void 0, void 0, function () {
            var inviteEmail, recipientId, owner, existing, created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        inviteEmail = parseEmailFromShareRecipientId(sharedWithUserId);
                        recipientId = inviteEmail ? emailShareIdFromEmail(inviteEmail) : sharedWithUserId;
                        if (recipientId === ownerUserId)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, this.getBoardByIdForUser(boardId, ownerUserId)];
                    case 1:
                        owner = _a.sent();
                        if (!owner)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.boardShares)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardShares.boardId, boardId), (0, drizzle_orm_1.eq)(schema_1.boardShares.sharedWithUserId, recipientId)))];
                    case 2:
                        existing = (_a.sent())[0];
                        if (existing)
                            return [2 /*return*/, existing];
                        return [4 /*yield*/, db_1.db
                                .insert(schema_1.boardShares)
                                .values({ boardId: boardId, sharedWithUserId: recipientId, sharedByUserId: ownerUserId })
                                .returning()];
                    case 3:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.unshareBoard = function (boardId, ownerUserId, sharedWithUserId) {
        return __awaiter(this, void 0, void 0, function () {
            var owner, deleted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getBoardByIdForUser(boardId, ownerUserId)];
                    case 1:
                        owner = _a.sent();
                        if (!owner)
                            return [2 /*return*/, false];
                        return [4 /*yield*/, db_1.db
                                .delete(schema_1.boardShares)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardShares.boardId, boardId), (0, drizzle_orm_1.eq)(schema_1.boardShares.sharedWithUserId, sharedWithUserId)))
                                .returning()];
                    case 2:
                        deleted = (_a.sent())[0];
                        return [2 /*return*/, !!deleted];
                }
            });
        });
    };
    MemStorage.prototype.leaveSharedBoard = function (boardId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var recipientIds, deleted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.resolveShareRecipientIdsForUser(userId)];
                    case 1:
                        recipientIds = _a.sent();
                        return [4 /*yield*/, db_1.db
                                .delete(schema_1.boardShares)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardShares.boardId, boardId), (0, drizzle_orm_1.inArray)(schema_1.boardShares.sharedWithUserId, recipientIds)))
                                .returning()];
                    case 2:
                        deleted = _a.sent();
                        return [2 /*return*/, deleted.length > 0];
                }
            });
        });
    };
    MemStorage.prototype.createBoard = function (board) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db.insert(schema_1.boards).values(board).returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.createNotification = function (notification) {
        return __awaiter(this, void 0, void 0, function () {
            var created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.notifications)
                            .values(notification)
                            .returning()];
                    case 1:
                        created = (_a.sent())[0];
                        return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.getNotificationsForUser = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                return [2 /*return*/, db_1.db
                        .select()
                        .from(schema_1.notifications)
                        .where((0, drizzle_orm_1.eq)(schema_1.notifications.userId, userId))
                        .orderBy((0, drizzle_orm_1.desc)(schema_1.notifications.createdAt))];
            });
        });
    };
    MemStorage.prototype.markNotificationRead = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.notifications)
                            .set({ isRead: true })
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notifications.id, id), (0, drizzle_orm_1.eq)(schema_1.notifications.userId, userId)))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.markAllNotificationsRead = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.notifications)
                            .set({ isRead: true })
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notifications.userId, userId), (0, drizzle_orm_1.eq)(schema_1.notifications.isRead, false)))
                            .returning()];
                    case 1:
                        updated = _a.sent();
                        return [2 /*return*/, updated.length];
                }
            });
        });
    };
    MemStorage.prototype.markNotificationsReadByType = function (userId, type) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.notifications)
                            .set({ isRead: true })
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.notifications.userId, userId), (0, drizzle_orm_1.eq)(schema_1.notifications.isRead, false), (0, drizzle_orm_1.eq)(schema_1.notifications.type, type)))
                            .returning()];
                    case 1:
                        updated = _a.sent();
                        return [2 /*return*/, updated.length];
                }
            });
        });
    };
    MemStorage.prototype.getAdminAlertSnoozeUntil = function (userId) {
        return __awaiter(this, void 0, void 0, function () {
            var row, until;
            var _a;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .select({ until: schema_1.users.adminAlertSnoozedUntil })
                            .from(schema_1.users)
                            .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))
                            .limit(1)];
                    case 1:
                        row = (_b.sent())[0];
                        until = (_a = row === null || row === void 0 ? void 0 : row.until) !== null && _a !== void 0 ? _a : null;
                        if (!until)
                            return [2 /*return*/, null];
                        if (!(until.getTime() <= Date.now())) return [3 /*break*/, 3];
                        // Lazily clear expired snoozes so the column doesn't accumulate
                        // stale values forever for users that never re-snooze.
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.users)
                                .set({ adminAlertSnoozedUntil: null })
                                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))];
                    case 2:
                        // Lazily clear expired snoozes so the column doesn't accumulate
                        // stale values forever for users that never re-snooze.
                        _b.sent();
                        return [2 /*return*/, null];
                    case 3: return [2 /*return*/, until];
                }
            });
        });
    };
    MemStorage.prototype.setAdminAlertSnoozeUntil = function (userId, until) {
        return __awaiter(this, void 0, void 0, function () {
            var next;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        next = until && until.getTime() > Date.now() ? until : null;
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.users)
                                .set({ adminAlertSnoozedUntil: next })
                                .where((0, drizzle_orm_1.eq)(schema_1.users.id, userId))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.updateBoardForUser = function (id, userId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.boards)
                            .set(__assign(__assign({}, updates), { updatedAt: new Date() }))
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boards.id, id), (0, drizzle_orm_1.eq)(schema_1.boards.userId, userId)))
                            .returning()];
                    case 1:
                        updated = (_a.sent())[0];
                        return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.touchBoardForUser = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .update(schema_1.boards)
                            .set({ updatedAt: new Date() })
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boards.id, id), (0, drizzle_orm_1.eq)(schema_1.boards.userId, userId)))];
                    case 1:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.deleteBoardForUser = function (id, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var deleted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .delete(schema_1.boards)
                            .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boards.id, id), (0, drizzle_orm_1.eq)(schema_1.boards.userId, userId)))
                            .returning()];
                    case 1:
                        deleted = (_a.sent())[0];
                        return [2 /*return*/, !!deleted];
                }
            });
        });
    };
    // ============== Board Assets (user-scoped via boards.userId) ==============
    MemStorage.prototype.getBoardAssetsForUser = function (boardId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var access, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAccessibleBoardForUser(boardId, userId)];
                    case 1:
                        access = _a.sent();
                        if (!access)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.boardAssets)
                                .where((0, drizzle_orm_1.eq)(schema_1.boardAssets.boardId, boardId))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.boardAssets.createdAt))];
                    case 2:
                        rows = _a.sent();
                        return [2 /*return*/, rows];
                }
            });
        });
    };
    MemStorage.prototype.getBoardAssetByIdForUser = function (boardId, assetId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var access, row;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAccessibleBoardForUser(boardId, userId)];
                    case 1:
                        access = _a.sent();
                        if (!access)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.boardAssets)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardAssets.id, assetId), (0, drizzle_orm_1.eq)(schema_1.boardAssets.boardId, boardId)))];
                    case 2:
                        row = (_a.sent())[0];
                        return [2 /*return*/, row];
                }
            });
        });
    };
    MemStorage.prototype.getBoardAssetSummariesForBoards = function (boardIds) {
        return __awaiter(this, void 0, void 0, function () {
            var result, unique, _i, unique_3, id, rows, _a, rows_3, r, entry;
            return __generator(this, function (_b) {
                switch (_b.label) {
                    case 0:
                        result = new Map();
                        if (!boardIds.length)
                            return [2 /*return*/, result];
                        unique = Array.from(new Set(boardIds));
                        for (_i = 0, unique_3 = unique; _i < unique_3.length; _i++) {
                            id = unique_3[_i];
                            result.set(id, { assetCount: 0, thumbnails: [] });
                        }
                        return [4 /*yield*/, db_1.db
                                .select({
                                id: schema_1.boardAssets.id,
                                boardId: schema_1.boardAssets.boardId,
                                kind: schema_1.boardAssets.kind,
                                thumbnailUrl: schema_1.boardAssets.thumbnailUrl,
                                assetUrl: schema_1.boardAssets.assetUrl,
                            })
                                .from(schema_1.boardAssets)
                                .where((0, drizzle_orm_1.inArray)(schema_1.boardAssets.boardId, unique))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.boardAssets.createdAt))];
                    case 1:
                        rows = _b.sent();
                        for (_a = 0, rows_3 = rows; _a < rows_3.length; _a++) {
                            r = rows_3[_a];
                            entry = result.get(r.boardId);
                            if (!entry)
                                continue;
                            entry.assetCount += 1;
                            if (entry.thumbnails.length < 4 && (r.thumbnailUrl || r.assetUrl)) {
                                entry.thumbnails.push({
                                    id: r.id,
                                    kind: r.kind,
                                    thumbnailUrl: r.thumbnailUrl,
                                    assetUrl: r.assetUrl,
                                });
                            }
                        }
                        return [2 /*return*/, result];
                }
            });
        });
    };
    MemStorage.prototype.createBoardAssetForUser = function (boardId, userId, asset) {
        return __awaiter(this, void 0, void 0, function () {
            var access, created;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAccessibleBoardForUser(boardId, userId)];
                    case 1:
                        access = _a.sent();
                        if (!access)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, db_1.db
                                .insert(schema_1.boardAssets)
                                .values(__assign(__assign({}, asset), { boardId: boardId }))
                                .returning()];
                    case 2:
                        created = (_a.sent())[0];
                        if (!created) return [3 /*break*/, 4];
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.boards)
                                .set({ updatedAt: new Date() })
                                .where((0, drizzle_orm_1.eq)(schema_1.boards.id, boardId))];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.updateBoardAssetForUser = function (boardId, assetId, userId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var existing, updated;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getBoardAssetByIdForUser(boardId, assetId, userId)];
                    case 1:
                        existing = _a.sent();
                        if (!existing)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.boardAssets)
                                .set(updates)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardAssets.id, assetId), (0, drizzle_orm_1.eq)(schema_1.boardAssets.boardId, boardId)))
                                .returning()];
                    case 2:
                        updated = (_a.sent())[0];
                        if (!updated) return [3 /*break*/, 4];
                        return [4 /*yield*/, db_1.db
                                .update(schema_1.boards)
                                .set({ updatedAt: new Date() })
                                .where((0, drizzle_orm_1.eq)(schema_1.boards.id, boardId))];
                    case 3:
                        _a.sent();
                        _a.label = 4;
                    case 4: return [2 /*return*/, updated];
                }
            });
        });
    };
    MemStorage.prototype.bulkUpdateBoardAssetPositionsForUser = function (boardId, userId, updates) {
        return __awaiter(this, void 0, void 0, function () {
            var byId, _i, updates_1, u, ids, access;
            var _this = this;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        if (updates.length === 0)
                            return [2 /*return*/, []];
                        byId = new Map();
                        for (_i = 0, updates_1 = updates; _i < updates_1.length; _i++) {
                            u = updates_1[_i];
                            byId.set(u.id, u);
                        }
                        ids = Array.from(byId.keys());
                        return [4 /*yield*/, this.getAccessibleBoardForUser(boardId, userId)];
                    case 1:
                        access = _a.sent();
                        if (!access)
                            return [2 /*return*/, undefined];
                        return [4 /*yield*/, db_1.db.transaction(function (tx) { return __awaiter(_this, void 0, void 0, function () {
                                var owned, updated, _i, _a, u, row;
                                return __generator(this, function (_b) {
                                    switch (_b.label) {
                                        case 0: return [4 /*yield*/, tx
                                                .select({ id: schema_1.boardAssets.id })
                                                .from(schema_1.boardAssets)
                                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardAssets.boardId, boardId), (0, drizzle_orm_1.inArray)(schema_1.boardAssets.id, ids)))];
                                        case 1:
                                            owned = _b.sent();
                                            if (owned.length !== ids.length)
                                                return [2 /*return*/, undefined];
                                            updated = [];
                                            _i = 0, _a = Array.from(byId.values());
                                            _b.label = 2;
                                        case 2:
                                            if (!(_i < _a.length)) return [3 /*break*/, 5];
                                            u = _a[_i];
                                            return [4 /*yield*/, tx
                                                    .update(schema_1.boardAssets)
                                                    .set({ positionX: u.positionX, positionY: u.positionY })
                                                    .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardAssets.id, u.id), (0, drizzle_orm_1.eq)(schema_1.boardAssets.boardId, boardId)))
                                                    .returning()];
                                        case 3:
                                            row = (_b.sent())[0];
                                            if (!row)
                                                return [2 /*return*/, undefined];
                                            updated.push(row);
                                            _b.label = 4;
                                        case 4:
                                            _i++;
                                            return [3 /*break*/, 2];
                                        case 5: 
                                        // Touch the parent board once for the whole batch. Not user-scoped:
                                        // a shared collaborator (Task #229) needs the bump to land too.
                                        return [4 /*yield*/, tx
                                                .update(schema_1.boards)
                                                .set({ updatedAt: new Date() })
                                                .where((0, drizzle_orm_1.eq)(schema_1.boards.id, boardId))];
                                        case 6:
                                            // Touch the parent board once for the whole batch. Not user-scoped:
                                            // a shared collaborator (Task #229) needs the bump to land too.
                                            _b.sent();
                                            return [2 /*return*/, updated];
                                    }
                                });
                            }); })];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.deleteBoardAssetForUser = function (boardId, assetId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var owner, existing, deleted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getBoardByIdForUser(boardId, userId)];
                    case 1:
                        owner = _a.sent();
                        if (!owner)
                            return [2 /*return*/, false];
                        return [4 /*yield*/, this.getBoardAssetByIdForUser(boardId, assetId, userId)];
                    case 2:
                        existing = _a.sent();
                        if (!existing)
                            return [2 /*return*/, false];
                        return [4 /*yield*/, db_1.db
                                .delete(schema_1.boardAssets)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardAssets.id, assetId), (0, drizzle_orm_1.eq)(schema_1.boardAssets.boardId, boardId)))
                                .returning()];
                    case 3:
                        deleted = (_a.sent())[0];
                        if (!deleted) return [3 /*break*/, 5];
                        return [4 /*yield*/, this.touchBoardForUser(boardId, userId)];
                    case 4:
                        _a.sent();
                        _a.label = 5;
                    case 5: return [2 /*return*/, !!deleted];
                }
            });
        });
    };
    // ----- Board chat messages -----
    // Read access: any user with access to the board (owner OR shared collaborator).
    // Write access: same — collaborators on a shared board chat with each other,
    // mirroring today's in-memory single-thread behavior.
    MemStorage.prototype.getBoardMessagesForUser = function (boardId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var access;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAccessibleBoardForUser(boardId, userId)];
                    case 1:
                        access = _a.sent();
                        if (!access)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.boardMessages)
                                .where((0, drizzle_orm_1.eq)(schema_1.boardMessages.boardId, boardId))
                                .orderBy(schema_1.boardMessages.createdAt)];
                    case 2: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.getBoardMessagesWithAuthorsForUser = function (boardId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var access, rows;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAccessibleBoardForUser(boardId, userId)];
                    case 1:
                        access = _a.sent();
                        if (!access)
                            return [2 /*return*/, []];
                        return [4 /*yield*/, db_1.db
                                .select({
                                message: schema_1.boardMessages,
                                authorName: schema_1.users.name,
                                authorEmail: schema_1.users.email,
                            })
                                .from(schema_1.boardMessages)
                                .leftJoin(schema_1.users, (0, drizzle_orm_1.eq)(schema_1.users.id, schema_1.boardMessages.authorUserId))
                                .where((0, drizzle_orm_1.eq)(schema_1.boardMessages.boardId, boardId))
                                .orderBy(schema_1.boardMessages.createdAt)];
                    case 2:
                        rows = _a.sent();
                        return [2 /*return*/, rows.map(function (r) {
                                var _a, _b;
                                return (__assign(__assign({}, r.message), { author: r.message.authorUserId
                                        ? {
                                            id: r.message.authorUserId,
                                            name: (_a = r.authorName) !== null && _a !== void 0 ? _a : null,
                                            email: (_b = r.authorEmail) !== null && _b !== void 0 ? _b : null,
                                        }
                                        : null }));
                            })];
                }
            });
        });
    };
    MemStorage.prototype.createBoardMessageForUser = function (boardId, userId, message) {
        return __awaiter(this, void 0, void 0, function () {
            var access, isUuid, created, cap, err_1;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getAccessibleBoardForUser(boardId, userId)];
                    case 1:
                        access = _a.sent();
                        if (!access)
                            return [2 /*return*/, undefined];
                        isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(userId);
                        return [4 /*yield*/, db_1.db
                                .insert(schema_1.boardMessages)
                                .values(__assign(__assign({}, message), { boardId: boardId, authorUserId: isUuid ? userId : null }))
                                .returning()];
                    case 2:
                        created = (_a.sent())[0];
                        _a.label = 3;
                    case 3:
                        _a.trys.push([3, 5, , 6]);
                        cap = clampBoardMessagesCap(access.chatHistoryCap);
                        return [4 /*yield*/, this.trimBoardMessagesIfNeeded(boardId, cap)];
                    case 4:
                        _a.sent();
                        return [3 /*break*/, 6];
                    case 5:
                        err_1 = _a.sent();
                        console.warn("[storage] auto-trim of board messages failed:", err_1 instanceof Error ? err_1.message : err_1);
                        return [3 /*break*/, 6];
                    case 6: return [2 /*return*/, created];
                }
            });
        });
    };
    MemStorage.prototype.recordHeygenShapeDriftIncident = function (incident) {
        return __awaiter(this, void 0, void 0, function () {
            var row;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.heygenShapeDriftIncidents)
                            .values(incident)
                            .returning()];
                    case 1:
                        row = (_a.sent())[0];
                        return [2 /*return*/, row];
                }
            });
        });
    };
    MemStorage.prototype.listHeygenShapeDriftIncidents = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var capped;
            if (limit === void 0) { limit = 100; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        capped = Math.max(1, Math.min(limit, 500));
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.heygenShapeDriftIncidents)
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.heygenShapeDriftIncidents.createdAt))
                                .limit(capped)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    MemStorage.prototype.trimBoardMessagesIfNeeded = function (boardId_1) {
        return __awaiter(this, arguments, void 0, function (boardId, cap) {
            var effectiveCap, keep, keepIds;
            if (cap === void 0) { cap = exports.BOARD_MESSAGES_CAP; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        effectiveCap = clampBoardMessagesCap(cap);
                        return [4 /*yield*/, db_1.db
                                .select({ id: schema_1.boardMessages.id })
                                .from(schema_1.boardMessages)
                                .where((0, drizzle_orm_1.eq)(schema_1.boardMessages.boardId, boardId))
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.boardMessages.createdAt))
                                .limit(effectiveCap)];
                    case 1:
                        keep = _a.sent();
                        if (keep.length < effectiveCap)
                            return [2 /*return*/];
                        keepIds = keep.map(function (r) { return r.id; });
                        return [4 /*yield*/, db_1.db
                                .delete(schema_1.boardMessages)
                                .where((0, drizzle_orm_1.and)((0, drizzle_orm_1.eq)(schema_1.boardMessages.boardId, boardId), (0, drizzle_orm_1.notInArray)(schema_1.boardMessages.id, keepIds)))];
                    case 2:
                        _a.sent();
                        return [2 /*return*/];
                }
            });
        });
    };
    MemStorage.prototype.clearBoardMessagesForUser = function (boardId, userId) {
        return __awaiter(this, void 0, void 0, function () {
            var owned, deleted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, this.getBoardByIdForUser(boardId, userId)];
                    case 1:
                        owned = _a.sent();
                        if (!owned)
                            return [2 /*return*/, null];
                        return [4 /*yield*/, db_1.db
                                .delete(schema_1.boardMessages)
                                .where((0, drizzle_orm_1.eq)(schema_1.boardMessages.boardId, boardId))
                                .returning({ id: schema_1.boardMessages.id })];
                    case 2:
                        deleted = _a.sent();
                        return [2 /*return*/, { deleted: deleted.length }];
                }
            });
        });
    };
    MemStorage.prototype.pruneHeygenShapeDriftIncidents = function (olderThanDays) {
        return __awaiter(this, void 0, void 0, function () {
            var days, cutoff, deleted;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        days = Math.max(1, Math.floor(olderThanDays));
                        cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
                        return [4 /*yield*/, db_1.db
                                .delete(schema_1.heygenShapeDriftIncidents)
                                .where((0, drizzle_orm_1.sql)(templateObject_6 || (templateObject_6 = __makeTemplateObject(["", " < ", ""], ["", " < ", ""])), schema_1.heygenShapeDriftIncidents.createdAt, cutoff))
                                .returning({ id: schema_1.heygenShapeDriftIncidents.id })];
                    case 1:
                        deleted = _a.sent();
                        return [2 /*return*/, deleted.length];
                }
            });
        });
    };
    MemStorage.prototype.recordHeygenShapeDriftRetentionRun = function (run) {
        return __awaiter(this, void 0, void 0, function () {
            var row;
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0: return [4 /*yield*/, db_1.db
                            .insert(schema_1.heygenShapeDriftRetentionRuns)
                            .values(run)
                            .returning()];
                    case 1:
                        row = (_a.sent())[0];
                        return [2 /*return*/, row];
                }
            });
        });
    };
    MemStorage.prototype.listHeygenShapeDriftRetentionRuns = function () {
        return __awaiter(this, arguments, void 0, function (limit) {
            var capped;
            if (limit === void 0) { limit = 30; }
            return __generator(this, function (_a) {
                switch (_a.label) {
                    case 0:
                        capped = Math.max(1, Math.min(limit, 200));
                        return [4 /*yield*/, db_1.db
                                .select()
                                .from(schema_1.heygenShapeDriftRetentionRuns)
                                .orderBy((0, drizzle_orm_1.desc)(schema_1.heygenShapeDriftRetentionRuns.createdAt))
                                .limit(capped)];
                    case 1: return [2 /*return*/, _a.sent()];
                }
            });
        });
    };
    return MemStorage;
}());
exports.MemStorage = MemStorage;
exports.storage = new MemStorage();
var templateObject_1, templateObject_2, templateObject_3, templateObject_4, templateObject_5, templateObject_6;

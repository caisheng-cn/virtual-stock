<template>
  <div class="admin-container">
    <div class="header">
      <h2>{{ $t('admin.title') }}</h2>
      <div>
        <el-select v-model="currentLang" size="small" style="width: 120px; margin-right: 10px;" @change="switchLang">
          <el-option label="简体中文" value="zh-CN" />
          <el-option label="繁體中文" value="zh-TW" />
          <el-option label="English" value="en" />
        </el-select>
        <el-button @click="handleLogout">{{ $t('admin.logout') }}</el-button>
      </div>
    </div>

    <el-container>
      <el-aside width="200px">
        <el-menu :default-active="activeMenu" @select="handleMenuSelect">
          <el-menu-item index="dashboard">
            <span>{{ $t('admin.dashboard') }}</span>
          </el-menu-item>
          <el-menu-item index="users">
            <span>{{ $t('admin.user_management') }}</span>
          </el-menu-item>
          <el-menu-item index="groups">
            <span>{{ $t('admin.group_management') }}</span>
          </el-menu-item>
          <el-menu-item index="stocks">
            <span>{{ $t('admin.stock_management') }}</span>
          </el-menu-item>
          <el-menu-item index="market-config">
            <span>{{ $t('admin.market_config') }}</span>
          </el-menu-item>
          <el-menu-item index="statistics">
            <span>{{ $t('admin.statistics_center') }}</span>
          </el-menu-item>
          <el-menu-item index="invite">
            <span>{{ $t('admin.invite_codes') }}</span>
          </el-menu-item>
          <el-menu-item index="commission">
            <span>{{ $t('admin.commission_settings') }}</span>
          </el-menu-item>
          <el-menu-item index="about">
            <span>{{ $t('admin.about') }}</span>
          </el-menu-item>
        </el-menu>
      </el-aside>

      <el-main>
        <div v-if="activeMenu === 'dashboard'" class="dashboard">
          <el-row :gutter="20">
            <el-col :span="6">
              <el-card shadow="hover">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('admin.total_users') }}</div>
                  <div class="stat-value">{{ stats.userCount || 0 }}</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('dashboard.today_new_users') }}</div>
                  <div class="stat-value highlight-blue">{{ stats.todayNewUsers || 0 }}</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('dashboard.active_users_7d') }}</div>
                  <div class="stat-value highlight-green">{{ stats.activeUsers7d || 0 }}</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('admin.total_groups') }}</div>
                  <div class="stat-value">{{ stats.groupCount || 0 }}</div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="20" style="margin-top: 20px;">
            <el-col :span="6">
              <el-card shadow="hover">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('admin.total_stocks') }}</div>
                  <div class="stat-value">{{ stats.stockCount || 0 }}</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('dashboard.total_transactions') }}</div>
                  <div class="stat-value">{{ stats.totalTransactions || 0 }}</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('dashboard.total_trade_amount') }}</div>
                  <div class="stat-value highlight-orange">¥{{ formatMoney(stats.totalTradeAmount) }}</div>
                </div>
              </el-card>
            </el-col>
            <el-col :span="6">
              <el-card shadow="hover">
                <div class="stat-item">
                  <div class="stat-label">{{ $t('dashboard.today_transactions') }}</div>
                  <div class="stat-value">{{ stats.todayTransactions || 0 }}</div>
                </div>
              </el-card>
            </el-col>
          </el-row>

          <el-row :gutter="20" style="margin-top: 20px;">
            <el-col :span="12">
              <el-card>
                <template #header>
                  <span><strong>{{ $t('dashboard.top_groups') }}</strong></span>
                </template>
                <div v-if="topGroups.length === 0" class="empty-card">{{ $t('common.no_data') }}</div>
                <div v-for="(g, i) in topGroups" :key="g.group_id" class="rank-row">
                  <span class="rank-badge" :class="'rank-' + (i+1)">{{ i + 1 }}</span>
                  <span class="rank-name">{{ g.group_name }}</span>
                  <span class="rank-value" :class="g.profit >= 0 ? 'profit' : 'loss'">
                    {{ g.profit >= 0 ? '+' : '' }}{{ formatMoney(g.profit) }}
                  </span>
                  <span class="rank-rate" :class="g.profit_rate >= 0 ? 'profit' : 'loss'">
                    {{ g.profit_rate >= 0 ? '+' : '' }}{{ g.profit_rate }}%
                  </span>
                </div>
              </el-card>
            </el-col>
            <el-col :span="12">
              <el-row :gutter="20">
                <el-col :span="12">
                  <el-card>
                    <template #header>
                      <span><strong>{{ $t('dashboard.top_traders') }}</strong></span>
                    </template>
                    <div v-if="topTraders.length === 0" class="empty-card">{{ $t('common.no_data') }}</div>
                    <div v-for="(u, i) in topTraders" :key="u.user_id" class="rank-row">
                      <span class="rank-badge" :class="'rank-' + (i+1)">{{ i + 1 }}</span>
                      <span class="rank-name">{{ u.username }}</span>
                      <span class="rank-value">{{ u.trade_count }}次</span>
                    </div>
                  </el-card>
                </el-col>
                <el-col :span="12">
                  <el-card>
                    <template #header>
                      <span><strong>{{ $t('dashboard.top_active_users') }}</strong></span>
                    </template>
                    <div v-if="topActiveUsers.length === 0" class="empty-card">{{ $t('common.no_data') }}</div>
                    <div v-for="(u, i) in topActiveUsers" :key="u.user_id" class="rank-row">
                      <span class="rank-badge" :class="'rank-' + (i+1)">{{ i + 1 }}</span>
                      <span class="rank-name">{{ u.username }}</span>
                      <span class="rank-value">{{ u.login_count }}次</span>
                    </div>
                  </el-card>
                </el-col>
              </el-row>
            </el-col>
          </el-row>
        </div>

        <div v-if="activeMenu === 'groups'" class="groups">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.group_list') }}</span>
                <el-button type="primary" @click="showGroupDialog = true; editingGroupId = null; groupForm.name = ''; groupForm.description = ''; groupForm.init_cash = 100000">{{ $t('admin.create_group') }}</el-button>
              </div>
            </template>
            <el-table :data="groupList">
              <el-table-column prop="id" :label="$t('admin.id')" width="60" />
              <el-table-column prop="name" :label="$t('admin.name')" />
              <el-table-column prop="description" :label="$t('admin.description')" />
              <el-table-column prop="init_cash" :label="$t('admin.init_funds')" width="120">
                <template #default="{ row }">{{ row.init_cash || '-' }}</template>
              </el-table-column>
              <el-table-column prop="status" :label="$t('admin.status')" width="80">
                <template #default="{ row }">{{ row.status === 1 ? $t('common.normal') : $t('common.disabled') }}</template>
              </el-table-column>
              <el-table-column :label="$t('common.operation')" width="200">
                <template #default="{ row }">
                  <el-button size="small" @click="viewGroupDetail(row)">{{ $t('common.detail') }}</el-button>
                  <el-button size="small" @click="editGroup(row)">{{ $t('common.edit') }}</el-button>
                  <el-button size="small" type="danger" @click="deleteGroup(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>

        <div v-if="activeMenu === 'users'" class="users">
          <el-card>
            <template #header>
              <span>{{ $t('admin.user_list') }}</span>
            </template>
            <el-table :data="userList">
              <el-table-column prop="id" :label="$t('admin.id')" width="60" />
              <el-table-column prop="username" :label="$t('auth.username')" />
              <el-table-column prop="nickname" :label="$t('admin.nickname')" />
              <el-table-column prop="status" :label="$t('admin.status')" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.status === 1 ? 'success' : 'danger'" clickable @click="toggleUserStatus(row)">
                    {{ row.status === 1 ? $t('common.normal') : $t('common.disabled') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="trade_enabled" :label="$t('admin.trade_permission')" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.trade_enabled === 1 ? 'success' : 'info'" clickable @click="toggleTradeEnabled(row)">
                    {{ row.trade_enabled === 1 ? $t('admin.allowed') : $t('admin.forbidden') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="admin_access" :label="$t('admin.admin_permission')" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.admin_access === 1 ? 'warning' : 'info'" clickable @click="toggleAdminAccess(row)">
                    {{ row.admin_access === 1 ? $t('admin.yes') : $t('admin.no') }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column prop="created_at" :label="$t('admin.register_time')" width="160" />
              <el-table-column :label="$t('common.operation')" width="140">
                <template #default="{ row }">
                  <el-button size="small" @click="viewUserDetail(row)">{{ $t('common.detail') }}</el-button>
                  <el-button size="small" type="danger" @click="deleteUser(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>

        <div v-if="activeMenu === 'stocks'" class="stocks">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.stock_pool') }}</span>
                <div>
                  <el-input v-model="stockKeyword" :placeholder="$t('trade_page.search_stock')" style="width: 180px; margin-right: 10px;" clearable @input="onStockKeywordInput" @clear="loadStocks" />
                  <el-select v-model="stockFilter" :placeholder="$t('admin.all_markets')" style="width: 120px; margin-right: 10px;" @change="loadStocks">
                    <el-option :label="$t('admin.all_markets')" :value="0" />
                    <el-option :label="$t('market.a_share')" :value="1" />
                    <el-option :label="$t('market.hk_stock')" :value="2" />
                    <el-option :label="$t('market.us_stock')" :value="3" />
                  </el-select>
                  <el-button type="primary" @click="showStockDialog = true">{{ $t('admin.add_stock') }}</el-button>
                </div>
              </div>
            </template>
            <el-table :data="stockList" stripe>
              <el-table-column prop="id" :label="$t('admin.id')" width="60" />
              <el-table-column prop="stock_code" :label="$t('admin.code')" width="100" />
              <el-table-column prop="stock_name" :label="$t('admin.stock_name')" />
              <el-table-column prop="market_type" :label="$t('admin.market')" width="80">
                <template #default="{ row }">{{ getMarketLabel(row.market_type) }}</template>
              </el-table-column>
              <el-table-column :label="$t('common.operation')" width="220">
                <template #default="{ row }">
                  <el-button size="small" type="success" @click="openDividendDialog(row)">{{ $t('admin.dividend') }}</el-button>
                  <el-button size="small" type="warning" @click="openAllotmentDialog(row)">{{ $t('admin.allotment') }}</el-button>
                  <el-button size="small" type="danger" @click="confirmDeleteStock(row)">{{ $t('common.delete') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-wrap">
              <el-pagination
                v-model:current-page="stockPage"
                :page-size="20"
                :total="stockTotal"
                layout="prev, pager, next, total"
                @current-change="loadStocks"
              />
            </div>
          </el-card>
        </div>

        <div v-if="activeMenu === 'invite'" class="invite">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.invite_codes') }}</span>
                <el-button type="primary" @click="showInviteDialog = true">{{ $t('admin.invite_codes') }}</el-button>
              </div>
            </template>
            <el-table :data="inviteList">
              <el-table-column prop="id" :label="$t('admin.id')" width="60" />
              <el-table-column prop="code" :label="$t('admin.invite_codes')" />
              <el-table-column prop="group_id" :label="$t('admin.id')" width="80" />
              <el-table-column prop="use_limit" :label="$t('admin.usage_limit')" width="100">
                <template #default="{ row }">{{ row.use_limit || $t('common.unknown') }}</template>
              </el-table-column>
              <el-table-column prop="used_count" :label="$t('admin.used_count')" width="80" />
              <el-table-column prop="expire_date" :label="$t('admin.expire_date')" width="120" />
            </el-table>
          </el-card>
        </div>

        <div v-if="activeMenu === 'commission'" class="commission">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.commission_settings') }}</span>
                <el-button type="info" size="small" @click="showCommissionHistoryDialog = true; loadCommissionHistory()">{{ $t('admin.view_history') }}</el-button>
              </div>
            </template>
            <el-table :data="commissionList" stripe>
              <el-table-column prop="id" :label="$t('admin.id')" width="60" />
              <el-table-column :label="$t('admin.market')" width="100">
                <template #default="{ row }">
                  {{ getMarketLabel(row.market_type) }}
                </template>
              </el-table-column>
              <el-table-column :label="$t('trade_page.trade_type')" width="100">
                <template #default="{ row }">
                  {{ row.trade_type === 1 ? $t('trade_page.buy') : $t('trade_page.sell') }}
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.commission_rate')" width="150">
                <template #default="{ row }">
                  {{ formatCommissionRate(row.commission_rate) }}
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.operation')" width="150">
                <template #default="{ row }">
                  <el-button size="small" @click="editCommission(row)">{{ $t('common.edit') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>

        <div v-if="activeMenu === 'market-config'" class="market-config">
          <el-card>
            <template #header>
              <span>{{ $t('admin.market_config') }}</span>
            </template>
            <el-table :data="marketConfigList" stripe>
              <el-table-column prop="id" :label="$t('admin.id')" width="60" />
              <el-table-column :label="$t('admin.market')" width="100">
                <template #default="{ row }">{{ getMarketLabel(row.market_type) }}</template>
              </el-table-column>
              <el-table-column prop="refresh_time" :label="$t('admin.refresh_time')" width="100" />
              <el-table-column prop="trade_start" :label="$t('admin.trade_start')" width="100" />
              <el-table-column prop="trade_end" :label="$t('admin.trade_end')" width="100" />
              <el-table-column :label="$t('admin.status')" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.enabled === 1 ? 'success' : 'info'">{{ row.enabled === 1 ? $t('common.normal') : $t('common.disabled') }}</el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('common.operation')" width="150">
                <template #default="{ row }">
                  <el-button size="small" @click="editMarketConfig(row)">{{ $t('admin.configure') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card style="margin-top: 20px;">
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.sync_stock_data') }}</span>
                <div>
                  <el-select v-model="syncMarketType" style="width: 120px; margin-right: 10px;">
                    <el-option :label="$t('market.a_share')" :value="1" />
                    <el-option :label="$t('market.hk_stock')" :value="2" />
                    <el-option :label="$t('market.us_stock')" :value="3" />
                  </el-select>
                  <el-button type="primary" :loading="syncLoading" :disabled="syncLoading" @click="startSync">
                    {{ syncLoading ? $t('admin.syncing') : $t('admin.start_sync') }}
                  </el-button>
                </div>
              </div>
            </template>
            <div v-if="syncLoading || syncProgress.status === 'completed' || syncProgress.status === 'failed' || syncProgress.status === 'cancelled'" style="padding: 10px 0;">
              <el-progress :percentage="syncPercentage" :status="syncProgress.status === 'failed' || syncProgress.status === 'cancelled' ? 'exception' : (syncPercentage >= 100 ? 'success' : undefined)" />
              <div style="display: flex; gap: 20px; margin-top: 12px; font-size: 14px; color: #666; align-items: center;">
                <span>{{ $t('admin.sync_total') }}: {{ syncProgress.total_count || 0 }}</span>
                <span>{{ $t('admin.sync_completed') }}: {{ syncProgress.completed_count || 0 }}</span>
                <span style="color: #67c23a;">{{ $t('admin.sync_success') }}: {{ syncProgress.success_count || 0 }}</span>
                <span v-if="syncProgress.fail_count > 0" style="color: #f56c6c;">{{ $t('admin.sync_fail') }}: {{ syncProgress.fail_count }}</span>
                <span v-if="syncProgress.current_stock">{{ $t('admin.sync_current') }}: {{ syncProgress.current_stock }}</span>
                <span>{{ $t('admin.sync_duration') }}: {{ formatDuration(syncProgress.duration_sec || 0) }}</span>
                <el-button v-if="syncProgress.status === 'running'" type="danger" size="small" :loading="cancelling" @click="cancelSync">
                  {{ $t('admin.sync_cancel') }}
                </el-button>
              </div>
            </div>
            <div v-else style="padding: 20px 0; text-align: center; color: #999;">
              {{ $t('admin.sync_not_running') }}
            </div>
          </el-card>

          <el-card style="margin-top: 20px;">
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.sync_history') }}</span>
                <el-button size="small" @click="loadSyncHistory">{{ $t('common.refresh') }}</el-button>
              </div>
            </template>
            <el-table :data="syncHistoryList" stripe @row-click="viewSyncDetail">
              <el-table-column prop="id" :label="$t('admin.id')" width="60" />
              <el-table-column :label="$t('admin.market')" width="80">
                <template #default="{ row }">{{ getMarketLabel(row.market_type) }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.status')" width="90">
                <template #default="{ row }">
                  <el-tag :type="row.status === 'completed' ? 'success' : (row.status === 'running' ? 'warning' : (row.status === 'cancelled' ? 'info' : 'danger'))" size="small">
                    {{ row.status === 'completed' ? $t('admin.sync_completed_status') : (row.status === 'running' ? $t('admin.sync_running') : (row.status === 'cancelled' ? $t('admin.sync_cancelled_status') : $t('admin.sync_failed_status'))) }}
                  </el-tag>
                </template>
              </el-table-column>
              <el-table-column :label="$t('admin.sync_total')" width="80">
                <template #default="{ row }">{{ row.total_count || 0 }}</template>
              </el-table-column>
              <el-table-column :label="$t('admin.sync_success')" width="80">
                <template #default="{ row }"><span style="color: #67c23a;">{{ row.success_count || 0 }}</span></template>
              </el-table-column>
              <el-table-column :label="$t('admin.sync_fail')" width="80">
                <template #default="{ row }"><span v-if="row.fail_count > 0" style="color: #f56c6c;">{{ row.fail_count }}</span><span v-else>0</span></template>
              </el-table-column>
              <el-table-column :label="$t('admin.sync_duration')" width="100">
                <template #default="{ row }">{{ formatDuration(row.duration_sec) }}</template>
              </el-table-column>
              <el-table-column prop="started_at" :label="$t('admin.update_time')" width="160">
                <template #default="{ row }">{{ new Date(row.started_at).toLocaleString() }}</template>
              </el-table-column>
              <el-table-column :label="$t('common.operation')" width="100">
                <template #default="{ row }">
                  <el-button size="small" type="primary" link @click.stop="viewSyncDetail(row)">{{ $t('admin.sync_detail') }}</el-button>
                </template>
              </el-table-column>
            </el-table>
            <div class="pagination-wrap">
              <el-pagination
                v-model:current-page="syncHistoryPage"
                :page-size="10"
                :total="syncHistoryTotal"
                layout="prev, pager, next, total"
                size="small"
                @current-change="loadSyncHistory"
              />
            </div>
          </el-card>

          <el-card style="margin-top: 20px;">
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.missing_data') }}</span>
                <el-button type="primary" size="small" @click="checkMissing">{{ $t('admin.check_missing') }}</el-button>
              </div>
            </template>
            <el-table :data="missingList">
              <el-table-column prop="stock_code" :label="$t('admin.code')" width="100" />
              <el-table-column prop="stock_name" :label="$t('admin.stock_name')" />
              <el-table-column prop="market_type" :label="$t('admin.market')" width="80">
                <template #default="{ row }">{{ getMarketLabel(row.market_type) }}</template>
              </el-table-column>
              <el-table-column prop="status" :label="$t('admin.status')" width="80">
                <template #default="{ row }">
                  <el-tag :type="row.status === '缺失' ? 'danger' : 'warning'">{{ row.status }}</el-tag>
                </template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>

        <div v-if="activeMenu === 'statistics'" class="statistics">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.statistics_center') }}</span>
                <div>
                  <el-button size="small" @click="statsPeriod = 'week'; loadGroupStats()">{{ $t('admin.last_week') }}</el-button>
                  <el-button size="small" @click="statsPeriod = 'month'; loadGroupStats()">{{ $t('admin.last_month') }}</el-button>
                  <el-button size="small" @click="statsPeriod = 'custom'; loadGroupStats()">{{ $t('admin.custom') }}</el-button>
                </div>
              </div>
            </template>
            <el-table :data="groupStats" stripe>
              <el-table-column prop="rank" :label="$t('group_page.rank')" width="60" />
              <el-table-column prop="group_name" :label="$t('admin.name')" />
              <el-table-column prop="init_cash" :label="$t('admin.init_funds')" width="120">
                <template #default="{ row }">{{ formatMoney(row.init_cash) }}</template>
              </el-table-column>
              <el-table-column prop="total_assets" :label="$t('nav.total_assets')" width="120">
                <template #default="{ row }">{{ formatMoney(row.total_assets) }}</template>
              </el-table-column>
              <el-table-column prop="profit" :label="$t('group_page.profit')" width="120">
                <template #default="{ row }">
                  <span :class="{ 'profit-positive': parseFloat(row.profit) > 0, 'profit-negative': parseFloat(row.profit) < 0 }">
                    {{ formatMoney(row.profit) }}
                  </span>
                </template>
              </el-table-column>
              <el-table-column prop="profit_rate" :label="$t('group_page.profit_rate')" width="100">
                <template #default="{ row }">{{ row.profit_rate }}%</template>
              </el-table-column>
            </el-table>
          </el-card>

          <el-card style="margin-top: 20px;">
            <template #header>
              <span>{{ $t('admin.user_activity') }}</span>
            </template>
            <el-table :data="userStats" stripe>
              <el-table-column prop="username" :label="$t('auth.username')" />
              <el-table-column prop="trade_count" :label="$t('admin.trade_count')" width="100" />
              <el-table-column prop="login_count" :label="$t('admin.login_count')" width="100" />
              <el-table-column prop="total_profit" :label="$t('admin.total_profit')" width="120">
                <template #default="{ row }">{{ formatMoney(row.total_profit) }}</template>
              </el-table-column>
            </el-table>
          </el-card>
        </div>

        <div v-if="activeMenu === 'about'" class="about-section">
          <el-card>
            <template #header>
              <div class="card-header">
                <span>{{ $t('admin.about') }}</span>
              </div>
            </template>
            <div class="about-content">
              <div class="info-row">
                <span class="label">{{ $t('about_page.version') }}</span>
                <span class="value">{{ aboutVersion }}</span>
              </div>
              <div class="info-row">
                <span class="label">{{ $t('about_page.copyright') }}</span>
                <span class="value">{{ aboutCopyright }}</span>
              </div>
              <div class="info-row">
                <span class="label">{{ $t('about_page.changelog') }}</span>
              </div>
              <el-table :data="aboutChangelog" stripe size="small">
                <el-table-column prop="ver" :label="$t('about_page.version')" width="100" />
                <el-table-column prop="date" :label="$t('group_page.date')" width="120" />
                <el-table-column prop="desc" :label="$t('admin.description')" />
              </el-table>
            </div>
          </el-card>
        </div>
      </el-main>
    </el-container>

    <el-dialog v-model="showGroupDialog" :title="editingGroupId ? $t('admin.edit_group') : $t('admin.create_group')">
      <el-form :model="groupForm">
        <el-form-item :label="$t('admin.name')">
          <el-input v-model="groupForm.name" />
        </el-form-item>
        <el-form-item :label="$t('admin.description')">
          <el-input v-model="groupForm.description" />
        </el-form-item>
        <el-form-item :label="$t('admin.init_funds')">
          <el-input-number v-model="groupForm.init_cash" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showGroupDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveGroup">{{ $t('common.submit') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showGroupDetailDialog" :title="`${$t('admin.group_members')} - ${selectedGroup.name}`" width="900px">
      <div style="margin-bottom: 16px;">
        <el-button type="primary" @click="openAddMemberDialog">{{ $t('admin.add_member') }}</el-button>
      </div>
      <el-table :data="groupDetailMembers" max-height="400">
        <el-table-column :label="$t('common.operation')" width="100">
          <template #default="{ row }">
            <el-button size="small" type="danger" @click="removeMember(row)">{{ $t('admin.remove_member') }}</el-button>
          </template>
        </el-table-column>
        <el-table-column prop="user_id" :label="$t('admin.id')" width="60" />
        <el-table-column prop="username" :label="$t('auth.username')" width="100" />
        <el-table-column prop="nickname" :label="$t('admin.nickname')" width="100" />
        <el-table-column prop="cash" :label="$t('admin.init_funds')" width="100">
          <template #default="{ row }">{{ Number(row.cash).toFixed(2) }}</template>
        </el-table-column>
        <el-table-column prop="total_assets" :label="$t('nav.market_value')" width="100">
          <template #default="{ row }">{{ row.total_assets }}</template>
        </el-table-column>
        <el-table-column prop="positions_shares" :label="$t('positions_page.shares')" width="90" />
        <el-table-column prop="profit" :label="$t('group_page.profit')" width="100">
          <template #default="{ row }">
            <span :class="Number(row.profit) >= 0 ? 'profit-text' : 'loss-text'">{{ row.profit }}</span>
          </template>
        </el-table-column>
        <el-table-column prop="profit_rate" :label="$t('group_page.profit_rate')" width="80">
          <template #default="{ row }">
            <span :class="Number(row.profit_rate) >= 0 ? 'profit-text' : 'loss-text'">{{ row.profit_rate }}%</span>
          </template>
        </el-table-column>
        <el-table-column prop="login_count" :label="$t('admin.login_count')" width="80" />
        <el-table-column prop="last_login_time" :label="$t('admin.login_time')" width="140">
          <template #default="{ row }">{{ formatDate(row.last_login_time) }}</template>
        </el-table-column>
        <el-table-column prop="last_trade_time" :label="$t('admin.trade_time')" width="140">
          <template #default="{ row }">{{ formatDate(row.last_trade_time) }}</template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showGroupDetailDialog = false">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAddMemberDialog" :title="$t('admin.add_member')" width="500px">
      <el-form :model="addMemberForm">
        <el-form-item :label="$t('admin.select_user')">
          <el-select
            v-model="addMemberForm.user_id"
            filterable
            :placeholder="$t('admin.search_user')"
            :loading="loadingAvailableUsers"
            style="width: 100%;"
          >
            <el-option
              v-for="user in availableUsers"
              :key="user.id"
              :label="user.username"
              :value="user.id"
            />
          </el-select>
        </el-form-item>
        <el-form-item :label="$t('admin.init_funds')">
          <el-input-number v-model="addMemberForm.init_cash" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAddMemberDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="addMember">{{ $t('common.submit') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showStockDialog" :title="$t('admin.add_stock')">
      <el-form :model="stockForm">
        <el-form-item :label="$t('admin.code')">
          <el-input v-model="stockForm.stock_code" />
        </el-form-item>
        <el-form-item :label="$t('admin.stock_name')">
          <el-input v-model="stockForm.stock_name" />
        </el-form-item>
        <el-form-item :label="$t('admin.market')">
          <el-select v-model="stockForm.market_type">
            <el-option :label="$t('market.a_share')" :value="1" />
            <el-option :label="$t('market.hk_stock')" :value="2" />
            <el-option :label="$t('market.us_stock')" :value="3" />
          </el-select>
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showStockDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="createStock">{{ $t('common.submit') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showInviteDialog" :title="$t('admin.invite_codes')">
      <el-form :model="inviteForm">
        <el-form-item :label="$t('admin.group_id')">
          <el-input-number v-model="inviteForm.group_id" />
        </el-form-item>
        <el-form-item :label="$t('admin.expire_days')">
          <el-input-number v-model="inviteForm.expire_days" :min="0" />
        </el-form-item>
        <el-form-item :label="$t('admin.usage_limit')">
          <el-input-number v-model="inviteForm.use_limit" :min="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showInviteDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="createInvite">{{ $t('common.submit') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showMarketConfigDialog" :title="$t('admin.market_config')">
      <el-form :model="marketConfigForm">
        <el-form-item :label="$t('admin.refresh_time')">
          <el-input v-model="marketConfigForm.refresh_time" placeholder="HH:mm" />
        </el-form-item>
        <el-form-item :label="$t('admin.trade_start_time')">
          <el-input v-model="marketConfigForm.trade_start" placeholder="HH:mm" />
        </el-form-item>
        <el-form-item :label="$t('admin.trade_end_time')">
          <el-input v-model="marketConfigForm.trade_end" placeholder="HH:mm" />
        </el-form-item>
        <el-form-item :label="$t('admin.enabled_status')">
          <el-switch v-model="marketConfigForm.enabled" :active-value="1" :inactive-value="0" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showMarketConfigDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveMarketConfig">{{ $t('common.submit') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showDividendDialog" :title="$t('admin.dividend_title')" width="450px">
      <div v-if="dividendStock" style="margin-bottom: 16px;">
        <p><strong>{{ dividendStock.stock_name }} ({{ dividendStock.stock_code }})</strong></p>
      </div>
      <el-form label-width="140px">
        <el-form-item :label="$t('admin.dividend_amount')">
          <el-input-number v-model="dividendAmount" :min="0.01" :step="0.1" :precision="2" style="width: 200px;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showDividendDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="success" @click="confirmDividend" :loading="dividendLoading">{{ $t('admin.confirm_dividend') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showAllotmentDialog" :title="$t('admin.allotment_title')" width="450px">
      <div v-if="allotmentStock" style="margin-bottom: 16px;">
        <p><strong>{{ allotmentStock.stock_name }} ({{ allotmentStock.stock_code }})</strong></p>
      </div>
      <el-form label-width="140px">
        <el-form-item :label="$t('admin.allotment_shares')">
          <el-input-number v-model="allotmentShares" :min="1" :step="1" style="width: 200px;" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showAllotmentDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="warning" @click="confirmAllotment" :loading="allotmentLoading">{{ $t('admin.confirm_allotment') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCommissionHistoryDialog" :title="$t('admin.commission_history')">
      <el-table :data="commissionHistoryList" max-height="400">
        <el-table-column prop="id" :label="$t('admin.id')" width="60" />
        <el-table-column :label="$t('admin.market')" width="80">
          <template #default="{ row }">{{ getMarketLabel(row.market_type) }}</template>
        </el-table-column>
        <el-table-column :label="$t('trade_page.trade_type')" width="60">
          <template #default="{ row }">{{ row.trade_type === 1 ? $t('trade_page.buy') : $t('trade_page.sell') }}</template>
        </el-table-column>
        <el-table-column :label="$t('admin.old_rate')" width="100">
          <template #default="{ row }">{{ formatCommissionRate(row.old_rate) }}</template>
        </el-table-column>
        <el-table-column :label="$t('admin.new_rate')" width="100">
          <template #default="{ row }">{{ formatCommissionRate(row.new_rate) }}</template>
        </el-table-column>
        <el-table-column prop="changed_at" :label="$t('admin.update_time')" width="150">
          <template #default="{ row }">{{ new Date(row.changed_at).toLocaleString() }}</template>
        </el-table-column>
        <el-table-column prop="remark" :label="$t('admin.remark')" />
      </el-table>
      <template #footer>
        <el-button @click="showCommissionHistoryDialog = false">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showCommissionDialog" :title="$t('admin.edit_commission')">
      <el-form :model="commissionForm">
        <el-form-item :label="$t('admin.market')">
          <el-input :value="getMarketLabel(commissionForm.market_type)" disabled />
        </el-form-item>
        <el-form-item :label="$t('trade_page.trade_type')">
          <el-input :value="commissionForm.trade_type === 1 ? $t('trade_page.buy') : $t('trade_page.sell')" disabled />
        </el-form-item>
        <el-form-item :label="$t('admin.commission_rate') + ' (‰)'">
          <el-input-number v-model="commissionForm.newRate" :precision="1" :step="0.1" :min="0" :max="100" />
        </el-form-item>
        <el-form-item :label="$t('admin.remark')">
          <el-input v-model="commissionForm.remark" :placeholder="$t('admin.remark')" />
        </el-form-item>
      </el-form>
      <template #footer>
        <el-button @click="showCommissionDialog = false">{{ $t('common.cancel') }}</el-button>
        <el-button type="primary" @click="saveCommission">{{ $t('common.submit') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showUserDetailDialog" :title="$t('admin.user_detail')" width="900px">
      <el-tabs v-model="userDetailActiveTab">
        <el-tab-pane :label="$t('admin.basic_info')" name="info">
          <el-descriptions v-if="userDetailData.user" :column="2" border>
            <el-descriptions-item :label="$t('auth.username')">{{ userDetailData.user.username }}</el-descriptions-item>
            <el-descriptions-item :label="$t('admin.nickname')">{{ userDetailData.user.nickname || '-' }}</el-descriptions-item>
            <el-descriptions-item :label="$t('admin.status')">
              <el-tag :type="userDetailData.user.status === 1 ? 'success' : 'danger'">{{ userDetailData.user.status === 1 ? $t('common.normal') : $t('common.disabled') }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('admin.trade_permission')">
              <el-tag :type="userDetailData.user.trade_enabled === 1 ? 'success' : 'info'">{{ userDetailData.user.trade_enabled === 1 ? $t('admin.allowed') : $t('admin.forbidden') }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('admin.admin_permission')">
              <el-tag :type="userDetailData.user.admin_access === 1 ? 'warning' : 'info'">{{ userDetailData.user.admin_access === 1 ? $t('admin.yes') : $t('admin.no') }}</el-tag>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('admin.register_time')">{{ userDetailData.user.created_at }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane :label="$t('admin.balance_info')" name="balance">
          <el-descriptions :column="3" border>
            <el-descriptions-item :label="$t('transactions_page.account_balance')">{{ formatMoney(userDetailData.balance?.cash) }}</el-descriptions-item>
            <el-descriptions-item :label="$t('positions_page.cost_price')">{{ formatMoney(userDetailData.balance?.total_cost) }}</el-descriptions-item>
            <el-descriptions-item :label="$t('admin.init_funds')">{{ formatMoney(userDetailData.balance?.init_cash) }}</el-descriptions-item>
            <el-descriptions-item :label="$t('nav.market_value')">{{ formatMoney(userDetailData.positions_value) }}</el-descriptions-item>
            <el-descriptions-item :label="$t('positions_page.floating_profit')">
              <span :class="{ 'profit-positive': parseFloat(userDetailData.floating_profit) > 0, 'profit-negative': parseFloat(userDetailData.floating_profit) < 0 }">
                {{ formatMoney(userDetailData.floating_profit) }}
              </span>
            </el-descriptions-item>
            <el-descriptions-item :label="$t('statistics_page.realized_profit')">{{ formatMoney(userDetailData.realized_profit) }}</el-descriptions-item>
          </el-descriptions>
        </el-tab-pane>

        <el-tab-pane :label="$t('admin.position_detail')" name="positions">
          <el-table :data="userDetailData.positions || []" size="small">
            <el-table-column prop="stock_code" :label="$t('admin.code')" width="100" />
            <el-table-column prop="shares" :label="$t('positions_page.shares')" width="80" />
            <el-table-column prop="avg_cost" :label="$t('positions_page.cost_price')" width="80">
              <template #default="{ row }">{{ formatMoney(row.avg_cost) }}</template>
            </el-table-column>
            <el-table-column prop="current_price" :label="$t('trade_page.current_price')" width="80">
              <template #default="{ row }">{{ formatMoney(row.current_price) }}</template>
            </el-table-column>
            <el-table-column prop="value" :label="$t('nav.market_value')" width="100">
              <template #default="{ row }">{{ formatMoney(row.value) }}</template>
            </el-table-column>
            <el-table-column prop="profit" :label="$t('positions_page.floating_profit')" width="100">
              <template #default="{ row }">
                <span :class="{ 'profit-positive': parseFloat(row.profit) > 0, 'profit-negative': parseFloat(row.profit) < 0 }">
                  {{ formatMoney(row.profit) }}
                </span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="$t('admin.login_history')" name="login">
          <el-table :data="userLoginHistoryList">
            <el-table-column prop="login_time" :label="$t('admin.login_time')" width="160" />
            <el-table-column prop="ip_address" :label="$t('admin.ip_address')" width="120" />
            <el-table-column prop="user_agent" :label="$t('admin.browser')" />
          </el-table>
        </el-tab-pane>

        <el-tab-pane :label="$t('admin.trade_records')" name="trade">
          <el-table :data="userTransactionsList">
            <el-table-column prop="trade_date" :label="$t('admin.trade_date')" width="100" />
            <el-table-column prop="stock_code" :label="$t('admin.code')" width="100" />
            <el-table-column :label="$t('statistics_page.type')" width="60">
              <template #default="{ row }">{{ row.trade_type === 1 ? $t('trade_page.buy') : $t('trade_page.sell') }}</template>
            </el-table-column>
            <el-table-column prop="shares" :label="$t('positions_page.shares')" width="80" />
            <el-table-column prop="price" :label="$t('group_page.price')" width="80">
              <template #default="{ row }">{{ formatMoney(row.price) }}</template>
            </el-table-column>
            <el-table-column prop="amount" :label="$t('statistics_page.amount')" width="100">
              <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
            </el-table-column>
            <el-table-column prop="commission" :label="$t('transactions_page.commission')" width="80">
              <template #default="{ row }">{{ formatMoney(row.commission) }}</template>
            </el-table-column>
            <el-table-column prop="profit" :label="$t('group_page.profit')" width="80">
              <template #default="{ row }">
                <span v-if="row.profit" :class="{ 'profit-positive': parseFloat(row.profit) > 0, 'profit-negative': parseFloat(row.profit) < 0 }">
                  {{ formatMoney(row.profit) }}
                </span>
                <span v-else>-</span>
              </template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
        <el-tab-pane :label="$t('fund_flow.title')" name="fund-flow">
          <div style="margin-bottom: 12px;">
            <el-date-picker
              v-model="fundFlowDateRange"
              type="daterange"
              :range-separator="$t('fund_flow.to')"
              :start-placeholder="$t('fund_flow.start_date')"
              :end-placeholder="$t('fund_flow.end_date')"
              value-format="YYYY-MM-DD"
              size="small"
              @change="loadUserFundFlow"
            />
          </div>
          <el-table :data="userFundFlowList" max-height="400">
            <el-table-column prop="tradeDate" :label="$t('fund_flow.date')" width="100" />
            <el-table-column :label="$t('fund_flow.type')" width="100">
              <template #default="{ row }">
                <el-tag :type="getFundFlowTagType(row.tradeType)" size="small">{{ getFundFlowTypeLabel(row.typeLabel) }}</el-tag>
              </template>
            </el-table-column>
            <el-table-column :label="$t('fund_flow.stock')" width="100">
              <template #default="{ row }">{{ row.stockName || row.stockCode || '-' }}</template>
            </el-table-column>
            <el-table-column :label="$t('fund_flow.change')" width="120">
              <template #default="{ row }">
                <span :class="row.changeAmount >= 0 ? 'profit-positive' : 'profit-negative'">
                  {{ row.changeAmount >= 0 ? '+' : '' }}{{ formatMoney(Math.abs(row.changeAmount)) }}
                </span>
              </template>
            </el-table-column>
            <el-table-column :label="$t('fund_flow.balance')" width="120">
              <template #default="{ row }">{{ formatMoney(row.balanceAfter) }}</template>
            </el-table-column>
          </el-table>
        </el-tab-pane>
      </el-tabs>
      <template #footer>
        <el-button @click="showUserDetailDialog = false">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showUserLoginHistoryDialog" :title="$t('admin.login_history')" width="600px">
      <el-table :data="userLoginHistoryList">
        <el-table-column prop="login_time" :label="$t('admin.login_time')" width="160" />
        <el-table-column prop="ip_address" :label="$t('admin.ip_address')" width="120" />
        <el-table-column prop="user_agent" :label="$t('admin.browser')" />
      </el-table>
      <template #footer>
        <el-button @click="showUserLoginHistoryDialog = false">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showUserTransactionsDialog" :title="$t('admin.trade_records')" width="800px">
      <el-table :data="userTransactionsList">
        <el-table-column prop="trade_date" :label="$t('admin.trade_date')" width="100" />
        <el-table-column prop="stock_code" :label="$t('admin.code')" width="100" />
        <el-table-column :label="$t('statistics_page.type')" width="60">
          <template #default="{ row }">{{ row.trade_type === 1 ? $t('trade_page.buy') : $t('trade_page.sell') }}</template>
        </el-table-column>
        <el-table-column prop="shares" :label="$t('positions_page.shares')" width="80" />
        <el-table-column prop="price" :label="$t('group_page.price')" width="80">
          <template #default="{ row }">{{ formatMoney(row.price) }}</template>
        </el-table-column>
        <el-table-column prop="amount" :label="$t('statistics_page.amount')" width="100">
          <template #default="{ row }">{{ formatMoney(row.amount) }}</template>
        </el-table-column>
        <el-table-column prop="commission" :label="$t('transactions_page.commission')" width="80">
          <template #default="{ row }">{{ formatMoney(row.commission) }}</template>
        </el-table-column>
        <el-table-column prop="profit" :label="$t('group_page.profit')" width="80">
          <template #default="{ row }">
            <span v-if="row.profit" :class="{ 'profit-positive': parseFloat(row.profit) > 0, 'profit-negative': parseFloat(row.profit) < 0 }">
              {{ formatMoney(row.profit) }}
            </span>
            <span v-else>-</span>
          </template>
        </el-table-column>
      </el-table>
      <template #footer>
        <el-button @click="showUserTransactionsDialog = false">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>

    <el-dialog v-model="showSyncDetailDialog" :title="$t('admin.sync_detail')" width="700px">
      <template v-if="syncDetailData">
        <el-descriptions :column="2" border style="margin-bottom: 16px;">
          <el-descriptions-item :label="$t('admin.market')">{{ getMarketLabel(syncDetailData.market_type) }}</el-descriptions-item>
          <el-descriptions-item :label="$t('admin.status')">
            <el-tag :type="syncDetailData.status === 'completed' ? 'success' : (syncDetailData.status === 'running' ? 'warning' : (syncDetailData.status === 'cancelled' ? 'info' : 'danger'))" size="small">
              {{ syncDetailData.status === 'completed' ? $t('admin.sync_completed_status') : (syncDetailData.status === 'running' ? $t('admin.sync_running') : (syncDetailData.status === 'cancelled' ? $t('admin.sync_cancelled_status') : $t('admin.sync_failed_status'))) }}
            </el-tag>
          </el-descriptions-item>
          <el-descriptions-item :label="$t('admin.sync_total')">{{ syncDetailData.total_count || 0 }}</el-descriptions-item>
          <el-descriptions-item :label="$t('admin.sync_completed')">{{ syncDetailData.completed_count || 0 }}</el-descriptions-item>
          <el-descriptions-item :label="$t('admin.sync_success')"><span style="color: #67c23a;">{{ syncDetailData.success_count || 0 }}</span></el-descriptions-item>
          <el-descriptions-item :label="$t('admin.sync_fail')"><span v-if="syncDetailData.fail_count > 0" style="color: #f56c6c;">{{ syncDetailData.fail_count }}</span><span v-else>0</span></el-descriptions-item>
          <el-descriptions-item :label="$t('admin.sync_duration')">{{ formatDuration(syncDetailData.duration_sec) }}</el-descriptions-item>
          <el-descriptions-item :label="$t('admin.update_time')">{{ new Date(syncDetailData.started_at).toLocaleString() }}</el-descriptions-item>
        </el-descriptions>
        <div v-if="syncDetailData.failed_stocks && syncDetailData.failed_stocks.length > 0">
          <h4 style="margin-bottom: 8px;">{{ $t('admin.failed_stocks') }}</h4>
          <el-table :data="syncDetailData.failed_stocks" size="small" max-height="300">
            <el-table-column prop="stock_code" :label="$t('admin.code')" width="100" />
            <el-table-column prop="stock_name" :label="$t('admin.stock_name')" />
            <el-table-column prop="error" :label="$t('admin.error_reason')">
              <template #default="{ row }"><span style="color: #f56c6c;">{{ row.error }}</span></template>
            </el-table-column>
          </el-table>
        </div>
        <div v-else style="text-align: center; color: #999; padding: 20px;">
          {{ $t('admin.no_failed_stocks') }}
        </div>
      </template>
      <template #footer>
        <el-button @click="showSyncDetailDialog = false">{{ $t('common.close') }}</el-button>
      </template>
    </el-dialog>
  </div>
</template>

<script setup>
/**
 * File: Admin.vue
 * Created: 2024-01-01
 * Author: CAISHENG <caisheng.cn@gmail.com>
 * Description: Full admin management panel with tabs for Dashboard, User/Group/Stock/
 *   Invite/Commission/Market/Statistics management. Includes user detail with multi-tab
 *   view, dividend/allotment operations, group member management, and system config.
 * Version History:
 *   - 2024-01-01: Initial version
 */
import { ref, reactive, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { i18n } from '@/i18n'
import { useI18n } from 'vue-i18n'
import { ElMessage, ElMessageBox } from 'element-plus'
import { getStats, getGroups, createGroup as createGroupAPI, deleteGroup as deleteGroupAPI, getUsers, toggleUserStatus as toggleUserStatusAPI, deleteUser as deleteUserAPI, getStocks, getStockPositions, createStock as createStockAPI, deleteStock as deleteStockAPI, getInviteCodes, createInviteCode, getCommissionConfigs, updateCommissionConfig, getCommissionHistory, getMarketConfig, updateMarketConfig, getMissingStocks, getGroupStatistics, getUserStatistics, getUserDetail, getUserLoginHistory, getUserTransactions, setTradeEnabled, setAdminAccess, getGroupUsers as getGroupUsersAPI, addGroupUser as addGroupUserAPI, removeGroupUser as removeGroupUserAPI, payDividend, doAllotment, getUserFundFlow, startStockSync, getStockSyncProgress, getStockSyncHistory, getStockSyncDetail, cancelStockSync } from '@/api/admin'
import { getVersion } from '@/api/about'

const router = useRouter()
const { t } = useI18n()
const currentLang = ref(i18n.global.locale.value)

/**
 * switchLang
 * Description: Switches the admin panel UI language.
 * @param {string} lang - The language code (e.g. 'zh-CN', 'zh-TW', 'en')
 * @returns {void}
 */
const switchLang = (lang) => { i18n.global.locale.value = lang }
const activeMenu = ref('dashboard')
const marketTypeMap = { 1: t('market.a_share'), 2: t('market.hk_stock'), 3: t('market.us_stock') }

const stats = ref({})
const groupList = ref([])
const userList = ref([])
const stockList = ref([])
const inviteList = ref([])
const commissionList = ref([])
const commissionHistoryList = ref([])
const aboutVersion = ref('')
const aboutCopyright = ref('')
const aboutChangelog = ref([])
const marketConfigList = ref([])
const missingList = ref([])
const groupStats = ref([])
const userStats = ref([])
const statsPeriod = ref('week')
const stockFilter = ref(0)
const stockPage = ref(1)
const stockTotal = ref(0)
const stockKeyword = ref('')

const userFundFlowList = ref([])
const fundFlowDateRange = ref([])

const showGroupDialog = ref(false)
const showStockDialog = ref(false)
const showDividendDialog = ref(false)
const showAllotmentDialog = ref(false)
const dividendStock = ref(null)
const allotmentStock = ref(null)
const dividendAmount = ref(0.1)
const allotmentShares = ref(1)
const dividendLoading = ref(false)
const allotmentLoading = ref(false)
const showInviteDialog = ref(false)
const showCommissionDialog = ref(false)
const showMarketConfigDialog = ref(false)
const showCommissionHistoryDialog = ref(false)
const showUserDetailDialog = ref(false)
const showUserLoginHistoryDialog = ref(false)
const showUserTransactionsDialog = ref(false)

const editingGroupId = ref(null)
const groupForm = reactive({ name: '', description: '', init_cash: 100000 })
const stockForm = reactive({ stock_code: '', stock_name: '', market_type: 1 })
const inviteForm = reactive({ group_id: 1, expire_days: 0, use_limit: 0 })
const commissionForm = reactive({ id: null, market_type: null, trade_type: null, newRate: 0, remark: '' })
const marketConfigForm = reactive({ id: null, refresh_time: '', trade_start: '', trade_end: '', enabled: 1 })

const loadingDetail = ref(true)
const userDetailActiveTab = ref('info')
const userDetailData = ref({})
const userLoginHistoryList = ref([])
const userTransactionsList = ref([])
const currentUserId = ref(null)

const showGroupDetailDialog = ref(false)
const groupDetailMembers = ref([])
const selectedGroup = ref({})
const showAddMemberDialog = ref(false)
const addMemberForm = reactive({ user_id: null, init_cash: 0 })
const availableUsers = ref([])
const searchUserKeyword = ref('')
const loadingAvailableUsers = ref(false)

const syncMarketType = ref(1)
const syncLoading = ref(false)
const syncProgress = ref({})
const syncTimer = ref(null)
const syncHistoryList = ref([])
const syncHistoryPage = ref(1)
const syncHistoryTotal = ref(0)
const showSyncDetailDialog = ref(false)
const syncDetailData = ref(null)
const cancelling = ref(false)
const syncRecordId = ref(null)

const syncPercentage = computed(() => {
  const total = syncProgress.value.total_count || 0
  const completed = syncProgress.value.completed_count || 0
  if (total === 0) return 0
  return Math.round((completed / total) * 100)
})

onMounted(() => {
  fetchData()
})

onUnmounted(() => {
  if (syncTimer.value) {
    clearInterval(syncTimer.value)
    syncTimer.value = null
  }
})

/**
 * fetchData
 * Description: Loads all admin dashboard data in parallel: stats, groups, users,
 *   stocks, invite codes, commission configs, market configs, and statistics.
 * @returns {Promise<void>}
 */
const fetchData = async () => {
  stats.value = await getStats().then(r => r.data || {})
  groupList.value = await getGroups().then(r => r.data?.list || [])
  userList.value = await getUsers().then(r => r.data?.list || [])
  await loadStocks()
  inviteList.value = await getInviteCodes().then(r => r.data?.list || [])
  commissionList.value = await getCommissionConfigs().then(r => r.data || [])
  marketConfigList.value = await getMarketConfig().then(r => r.data || [])
  await loadGroupStats()
  await loadUserStats()
}

/**
 * loadStocks
 * Description: Loads the stock list with pagination and optional market type filter.
 * @returns {Promise<void>}
 */
const loadStocks = async () => {
  const params = { page: stockPage.value, pageSize: 20 }
  if (stockFilter.value) params.market_type = stockFilter.value
  if (stockKeyword.value) params.keyword = stockKeyword.value
  const res = await getStocks(params)
  stockList.value = res.data?.list || []
  stockTotal.value = res.data?.total || 0
}

const onStockKeywordInput = () => {
  stockPage.value = 1
  loadStocks()
}

/**
 * loadGroupStats
 * Description: Loads group statistics for the selected period (week/month/custom).
 * @returns {Promise<void>}
 */
const loadGroupStats = async () => {
  groupStats.value = await getGroupStatistics({ period: statsPeriod.value }).then(r => r.data || [])
}

/**
 * loadUserStats
 * Description: Loads user activity statistics.
 * @returns {Promise<void>}
 */
const loadUserStats = async () => {
  userStats.value = await getUserStatistics().then(r => r.data || [])
}

const formatDuration = (sec) => {
  if (!sec) return '0:00'
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${m}:${s.toString().padStart(2, '0')}`
}

const startSync = async () => {
  try {
    const res = await startStockSync({ market_type: syncMarketType.value })
    if (res.code !== 0) {
      ElMessage.error(res.message || t('admin.operate_failed'))
      return
    }
    syncLoading.value = true
    syncRecordId.value = res.data.id
    cancelling.value = false
    syncProgress.value = { status: 'running', total_count: 0, completed_count: 0, success_count: 0, fail_count: 0, current_stock: '', duration_sec: 0 }
    pollSyncProgress(res.data.id)
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

const cancelSync = async () => {
  try {
    await ElMessageBox.confirm(t('admin.sync_cancel_confirm'), t('common.confirm'), {
      confirmButtonText: t('admin.sync_cancel'),
      cancelButtonText: t('common.cancel'),
      type: 'warning'
    })
    cancelling.value = true
    await cancelStockSync(syncRecordId.value)
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || t('admin.operate_failed'))
    }
    cancelling.value = false
  }
}

const pollSyncProgress = (id) => {
  syncTimer.value = setInterval(async () => {
    try {
      const res = await getStockSyncProgress(id)
      if (res.code === 0 && res.data) {
        syncProgress.value = res.data
        if (res.data.status === 'completed' || res.data.status === 'failed' || res.data.status === 'cancelled') {
          clearInterval(syncTimer.value)
          syncTimer.value = null
          syncLoading.value = false
          if (res.data.status === 'completed') {
            ElMessage.success(t('admin.update_success'))
          } else if (res.data.status === 'cancelled') {
            ElMessage.info(t('admin.sync_cancelled'))
          }
          loadSyncHistory()
        }
      }
    } catch (err) {
      clearInterval(syncTimer.value)
      syncTimer.value = null
      syncLoading.value = false
      console.error('Poll sync progress error:', err)
    }
  }, 5000)
}

const loadSyncHistory = async () => {
  try {
    const params = { page: syncHistoryPage.value, pageSize: 10 }
    const res = await getStockSyncHistory(params)
    syncHistoryList.value = res.data?.list || []
    syncHistoryTotal.value = res.data?.total || 0
  } catch (err) {
    console.error('Load sync history error:', err)
  }
}

const viewSyncDetail = async (row) => {
  try {
    const res = await getStockSyncDetail(row.id)
    if (res.code === 0 && res.data) {
      syncDetailData.value = res.data
      showSyncDetailDialog.value = true
    }
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * getMarketLabel
 * Description: Returns the display label for a given market type.
 * @param {number} marketType - The market type (1=A, 2=HK, 3=US)
 * @returns {string} The market label string
 */
const getMarketLabel = (marketType) => {
  const labels = { 1: t('market.a_share'), 2: t('market.hk_stock'), 3: t('market.us_stock') }
  return labels[marketType] || t('common.unknown')
}

/**
 * formatMoney
 * Description: Formats a numeric value as a locale-specific currency string.
 * @param {number} value - The numeric value to format
 * @returns {string} The formatted money string
 */
const formatMoney = (value) => {
  if (!value) return '0.00'
  return parseFloat(value).toLocaleString('zh-CN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
}

/**
 * formatCommissionRate
 * Description: Formats a commission rate value as a per-mille string.
 * @param {number|string} rate - The commission rate value
 * @returns {string} The formatted rate string (e.g. "0.5‰")
 */
const formatCommissionRate = (rate) => {
  return parseFloat(rate).toFixed(1) + '‰'
}

const topGroups = computed(() => {
  const sorted = [...groupStats.value].sort((a, b) => parseFloat(b.profit) - parseFloat(a.profit))
  return sorted.slice(0, 3)
})

const topTraders = computed(() => {
  const sorted = [...userStats.value].sort((a, b) => b.trade_count - a.trade_count)
  return sorted.slice(0, 3)
})

const topActiveUsers = computed(() => {
  const sorted = [...userStats.value].sort((a, b) => b.login_count - a.login_count)
  return sorted.slice(0, 3)
})

/**
 * editCommission
 * Description: Opens the commission edit dialog with pre-filled values from the selected row.
 * @param {Object} row - The commission config row to edit
 * @returns {void}
 */
const editCommission = (row) => {
  commissionForm.id = row.id
  commissionForm.market_type = row.market_type
  commissionForm.trade_type = row.trade_type
  commissionForm.newRate = parseFloat(row.commission_rate)
  commissionForm.remark = ''
  showCommissionDialog.value = true
}

/**
 * saveCommission
 * Description: Saves the updated commission rate configuration.
 * @returns {Promise<void>}
 */
const saveCommission = async () => {
  try {
    await updateCommissionConfig(commissionForm.id, { commission_rate: commissionForm.newRate, remark: commissionForm.remark })
    ElMessage.success(t('admin.update_success'))
    showCommissionDialog.value = false
    commissionList.value = await getCommissionConfigs().then(r => r.data || [])
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * editMarketConfig
 * Description: Opens the market config edit dialog with pre-filled values from the selected row.
 * @param {Object} row - The market config row to edit
 * @returns {void}
 */
const editMarketConfig = (row) => {
  marketConfigForm.id = row.id
  marketConfigForm.refresh_time = row.refresh_time
  marketConfigForm.trade_start = row.trade_start
  marketConfigForm.trade_end = row.trade_end
  marketConfigForm.enabled = row.enabled
  showMarketConfigDialog.value = true
}

/**
 * saveMarketConfig
 * Description: Saves the updated market configuration settings.
 * @returns {Promise<void>}
 */
const saveMarketConfig = async () => {
  try {
    await updateMarketConfig(marketConfigForm.id, marketConfigForm)
    ElMessage.success(t('admin.update_success'))
    showMarketConfigDialog.value = false
    marketConfigList.value = await getMarketConfig().then(r => r.data || [])
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * loadCommissionHistory
 * Description: Loads the history of commission rate changes.
 * @returns {Promise<void>}
 */
const loadCommissionHistory = async () => {
  commissionHistoryList.value = await getCommissionHistory().then(r => r.data?.list || [])
}

/**
 * checkMissing
 * Description: Checks for stocks with missing data and displays the result.
 * @returns {Promise<void>}
 */
const checkMissing = async () => {
  missingList.value = await getMissingStocks().then(r => r.data || [])
  ElMessage.success(t('admin.update_success'))
}

/**
 * handleMenuSelect
 * Description: Handles sidebar menu item selection and switches the active view.
 * @param {string} index - The menu item index
 * @returns {void}
 */
const handleMenuSelect = (index) => {
  activeMenu.value = index
  if (index === 'about') {
    loadAbout()
  }
  if (index === 'market-config') {
    loadSyncHistory()
    checkRunningSync()
  } else {
    if (syncTimer.value) {
      clearInterval(syncTimer.value)
      syncTimer.value = null
    }
  }
}

const checkRunningSync = async () => {
  try {
    const res = await getStockSyncHistory({ page: 1, pageSize: 1 })
    const list = res.data?.list || []
    const running = list.find(r => r.status === 'running')
    if (running) {
      syncLoading.value = true
      syncRecordId.value = running.id
      cancelling.value = false
      syncProgress.value = { status: 'running', total_count: 0, completed_count: 0, success_count: 0, fail_count: 0, current_stock: '', duration_sec: 0 }
      pollSyncProgress(running.id)
    }
  } catch (err) {
    console.error('Check running sync error:', err)
  }
}

/**
 * loadAbout
 * Description: Loads version, copyright, and changelog info for the About section.
 * @returns {Promise<void>}
 */
const loadAbout = async () => {
  try {
    const res = await getVersion()
    if (res.code === 0) {
      aboutVersion.value = res.data.version
      aboutCopyright.value = res.data.copyright
      aboutChangelog.value = res.data.changelog || []
    }
  } catch (err) {
    console.error('Failed to load about:', err)
  }
}

/**
 * editGroup
 * Description: Opens the group edit dialog with pre-filled values from the selected row.
 * @param {Object} row - The group row to edit
 * @returns {void}
 */
const editGroup = (row) => {
  editingGroupId.value = row.id
  groupForm.name = row.name
  groupForm.description = row.description || ''
  groupForm.init_cash = Number(row.init_cash)
  showGroupDialog.value = true
}

/**
 * saveGroup
 * Description: Creates a new group or updates an existing one based on editingGroupId.
 * @returns {Promise<void>}
 */
const saveGroup = async () => {
  try {
    if (editingGroupId.value) {
      await updateGroup(editingGroupId.value, groupForm)
      ElMessage.success(t('admin.update_success'))
    } else {
      await createGroupAPI(groupForm)
      ElMessage.success(t('admin.create_success'))
    }
    showGroupDialog.value = false
    editingGroupId.value = null
    groupList.value = await getGroups().then(r => r.data?.list || [])
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * deleteGroup
 * Description: Prompts for admin password and deletes the selected group.
 * @param {Object} row - The group row to delete
 * @returns {Promise<void>}
 */
const deleteGroup = async (row) => {
  try {
    const { value: password } = await ElMessageBox.prompt(
      t('admin.delete_group_confirm', { groupName: row.name }),
      t('common.confirm'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        inputType: 'password',
        inputPlaceholder: t('admin.input_admin_password')
      }
    )
    await deleteGroupAPI(row.id, { password })
    ElMessage.success(t('admin.delete_success'))
    groupList.value = await getGroups().then(r => r.data?.list || [])
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || t('admin.operate_failed'))
    }
  }
}

/**
 * viewGroupDetail
 * Description: Opens the group detail dialog showing all members of the group.
 * @param {Object} row - The group row to view details for
 * @returns {Promise<void>}
 */
const viewGroupDetail = async (row) => {
  selectedGroup.value = row
  showGroupDetailDialog.value = true
  try {
    const res = await getGroupUsersAPI(row.id)
    groupDetailMembers.value = res.data?.list || []
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * loadAvailableUsers
 * Description: Loads users not already in the selected group for adding as members.
 * @returns {Promise<void>}
 */
const loadAvailableUsers = async () => {
  loadingAvailableUsers.value = true
  try {
    const res = await getUsers({ keyword: searchUserKeyword.value, pageSize: 100 })
    const groupUserIds = groupDetailMembers.value.map(m => m.user_id)
    availableUsers.value = (res.data?.list || []).filter(u => !groupUserIds.includes(u.id))
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  } finally {
    loadingAvailableUsers.value = false
  }
}

/**
 * openAddMemberDialog
 * Description: Opens the dialog for adding a new member to the selected group.
 * @returns {Promise<void>}
 */
const openAddMemberDialog = async () => {
  showAddMemberDialog.value = true
  searchUserKeyword.value = ''
  availableUsers.value = []
  await loadAvailableUsers()
}

/**
 * addMember
 * Description: Adds the selected user as a member of the current group.
 * @returns {Promise<void>}
 */
const addMember = async () => {
  if (!addMemberForm.user_id) {
    ElMessage.warning(t('admin.select_user'))
    return
  }
  try {
    await addGroupUserAPI(selectedGroup.value.id, {
      user_id: addMemberForm.user_id,
      init_cash: addMemberForm.init_cash
    })
    ElMessage.success(t('admin.create_success'))
    showAddMemberDialog.value = false
    const res = await getGroupUsersAPI(selectedGroup.value.id)
    groupDetailMembers.value = res.data?.list || []
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * removeMember
 * Description: Removes a member from the selected group after confirmation.
 * @param {Object} row - The member row to remove
 * @returns {Promise<void>}
 */
const removeMember = async (row) => {
  try {
    await ElMessageBox.confirm(
      `${t('common.confirm')} ${t('common.delete')} ${t('auth.username')} "${row.username}" ${t('admin.group_management')} ?`,
      t('common.confirm'),
      { confirmButtonText: t('admin.remove_member'), cancelButtonText: t('common.cancel'), type: 'warning' }
    )
    await removeGroupUserAPI(selectedGroup.value.id, row.user_id)
    ElMessage.success(t('admin.delete_success'))
    const res = await getGroupUsersAPI(selectedGroup.value.id)
    groupDetailMembers.value = res.data?.list || []
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || t('admin.operate_failed'))
    }
  }
}

/**
 * formatDate
 * Description: Formats a date string to a localized Chinese date-time format.
 * @param {string} date - The date string to format
 * @returns {string} The formatted date string
 */
const formatDate = (date) => {
  if (!date) return '-'
  return new Date(date).toLocaleString('zh-CN')
}

/**
 * toggleUserStatus
 * Description: Toggles a user's status between normal and disabled.
 * @param {Object} row - The user row to toggle status for
 * @returns {Promise<void>}
 */
const toggleUserStatus = async (row) => {
  try {
    await toggleUserStatusAPI(row.id, { status: row.status === 1 ? 0 : 1 })
    ElMessage.success(t('admin.update_success'))
    userList.value = await getUsers().then(r => r.data?.list || [])
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * deleteUser
 * Description: Prompts for admin password and deletes the selected user.
 * @param {Object} row - The user row to delete
 * @returns {Promise<void>}
 */
const deleteUser = async (row) => {
  try {
    const { value: password } = await ElMessageBox.prompt(
      t('admin.delete_user_confirm', { username: row.username }),
      t('common.confirm'),
      {
        confirmButtonText: t('common.delete'),
        cancelButtonText: t('common.cancel'),
        type: 'warning',
        inputType: 'password',
        inputPlaceholder: t('admin.input_admin_password')
      }
    )
    await deleteUserAPI(row.id, { password })
    ElMessage.success(t('admin.delete_success'))
    userList.value = await getUsers().then(r => r.data?.list || [])
  } catch (err) {
    if (err !== 'cancel') {
      ElMessage.error(err.message || t('admin.operate_failed'))
    }
  }
}

/**
 * viewUserDetail
 * Description: Opens the user detail dialog with tabs for info, balance, positions,
 *   login history, trade records, and fund flow.
 * @param {Object} row - The user row to view details for
 * @returns {Promise<void>}
 */
const viewUserDetail = async (row) => {
  currentUserId.value = row.id
  userDetailActiveTab.value = 'info'
  userFundFlowList.value = []
  const oneMonthAgo = new Date()
  oneMonthAgo.setMonth(oneMonthAgo.getMonth() - 1)
  fundFlowDateRange.value = [oneMonthAgo.toISOString().split('T')[0], new Date().toISOString().split('T')[0]]
  try {
    const [detailRes, loginRes, tradeRes, fundFlowRes] = await Promise.all([
      getUserDetail(row.id),
      getUserLoginHistory(row.id),
      getUserTransactions(row.id),
      getUserFundFlow(row.id)
    ])
    userDetailData.value = detailRes.data || {}
    userLoginHistoryList.value = loginRes.data?.list || []
    userTransactionsList.value = tradeRes.data?.list || []
    userFundFlowList.value = fundFlowRes.data?.list || []
    showUserDetailDialog.value = true
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * loadUserFundFlow
 * Description: Loads fund flow records for the current user with date range filter.
 * @returns {Promise<void>}
 */
const loadUserFundFlow = async () => {
  if (!currentUserId.value) return
  try {
    const params = {}
    if (fundFlowDateRange.value && fundFlowDateRange.value.length === 2) {
      params.start_date = fundFlowDateRange.value[0]
      params.end_date = fundFlowDateRange.value[1]
    }
    const res = await getUserFundFlow(currentUserId.value, params)
    userFundFlowList.value = res.data?.list || []
  } catch (err) {
    ElMessage.error(err.message || t('fund_flow.fetch_failed'))
  }
}

/**
 * getFundFlowTagType
 * Description: Returns the Element Plus tag type for a given fund flow trade type.
 * @param {number} tradeType - The trade type code
 * @returns {string} The tag type string
 */
const getFundFlowTagType = (tradeType) => {
  const map = { 5: 'success', 1: 'danger', 2: 'success', 3: 'warning', 4: 'info' }
  return map[tradeType] || ''
}

/**
 * getFundFlowTypeLabel
 * Description: Returns the display label for a given fund flow type.
 * @param {string} label - The type label key
 * @returns {string} The localized type label
 */
const getFundFlowTypeLabel = (label) => {
  const labels = {
    initial_fund: t('fund_flow.initial_fund'),
    buy_stock: t('fund_flow.buy_stock'),
    sell_stock: t('fund_flow.sell_stock'),
    dividend: t('fund_flow.dividend'),
    allotment: t('fund_flow.allotment'),
    unknown: t('common.unknown')
  }
  return labels[label] || label
}

/**
 * toggleTradeEnabled
 * Description: Toggles a user's trade permission between allowed and forbidden.
 * @param {Object} row - The user row to toggle trade permission for
 * @returns {Promise<void>}
 */
const toggleTradeEnabled = async (row) => {
  const newValue = row.trade_enabled === 1 ? 0 : 1
  try {
    await setTradeEnabled(row.id, { trade_enabled: newValue })
    ElMessage.success(t('admin.update_success'))
    userList.value = await getUsers().then(r => r.data?.list || [])
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * toggleAdminAccess
 * Description: Toggles a user's admin access between yes and no.
 * @param {Object} row - The user row to toggle admin access for
 * @returns {Promise<void>}
 */
const toggleAdminAccess = async (row) => {
  const newValue = row.admin_access === 1 ? 0 : 1
  try {
    await setAdminAccess(row.id, { admin_access: newValue })
    ElMessage.success(t('admin.update_success'))
    userList.value = await getUsers().then(r => r.data?.list || [])
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * loadUserLoginHistory
 * Description: Loads the login history for the currently selected user.
 * @returns {Promise<void>}
 */
const loadUserLoginHistory = async () => {
  try {
    const res = await getUserLoginHistory(currentUserId.value)
    userLoginHistoryList.value = res.data?.list || []
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * loadUserTransactions
 * Description: Loads the transaction records for the currently selected user.
 * @returns {Promise<void>}
 */
const loadUserTransactions = async () => {
  try {
    const res = await getUserTransactions(currentUserId.value)
    userTransactionsList.value = res.data?.list || []
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * createStock
 * Description: Creates a new stock entry via the API and refreshes the stock list.
 * @returns {Promise<void>}
 */
const createStock = async () => {
  try {
    await createStockAPI(stockForm)
    ElMessage.success(t('admin.create_success'))
    showStockDialog.value = false
    stockPage.value = 1
    loadStocks()
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * confirmDeleteStock
 * Description: Deletes a stock after checking for existing positions and user confirmation.
 * @param {Object} row - The stock row to delete
 * @returns {Promise<void>}
 */
const confirmDeleteStock = async (row) => {
  try {
    const res = await getStockPositions(row.id)
    const hasPosition = res.data?.positions?.length > 0
    if (hasPosition) {
      const users = res.data.positions.map(p => p.username).join(', ')
      ElMessage.warning(`${t('admin.stock_name')} ${row.stock_name} (${row.stock_code}) ${t('admin.total_users')} (${users}) ${t('admin.operate_failed')}`)
      return
    }
    ElMessageBox.confirm(
      `${t('common.confirm')} ${t('common.delete')} ${t('admin.stock_name')} ${row.stock_name} (${row.stock_code}) ?`,
      t('common.confirm'),
      { confirmButtonText: t('common.delete'), cancelButtonText: t('common.cancel'), type: 'warning' }
    ).then(async () => {
      await deleteStockAPI(row.id)
      ElMessage.success(t('admin.delete_success'))
      await loadStocks()
    }).catch(() => {})
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * openDividendDialog
 * Description: Opens the dividend payment dialog for the selected stock.
 * @param {Object} row - The stock row to pay dividends for
 * @returns {void}
 */
const openDividendDialog = (row) => {
  dividendStock.value = row
  dividendAmount.value = 0.1
  showDividendDialog.value = true
}

/**
 * confirmDividend
 * Description: Executes the dividend payment for the selected stock.
 * @returns {Promise<void>}
 */
const confirmDividend = async () => {
  if (!dividendAmount.value || dividendAmount.value <= 0) {
    return ElMessage.warning(t('admin.dividend_amount'))
  }
  dividendLoading.value = true
  try {
    const res = await payDividend(dividendStock.value.id, { amount_per_share: dividendAmount.value })
    const count = res.data?.affected_users || 0
    ElMessage.success(`${t('admin.dividend_success')}，${t('admin.dividend_affected', { n: count })}`)
    showDividendDialog.value = false
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  } finally {
    dividendLoading.value = false
  }
}

/**
 * openAllotmentDialog
 * Description: Opens the allotment (bonus share) dialog for the selected stock.
 * @param {Object} row - The stock row to issue allotments for
 * @returns {void}
 */
const openAllotmentDialog = (row) => {
  allotmentStock.value = row
  allotmentShares.value = 1
  showAllotmentDialog.value = true
}

/**
 * confirmAllotment
 * Description: Executes the share allotment (bonus shares) for the selected stock.
 * @returns {Promise<void>}
 */
const confirmAllotment = async () => {
  if (!allotmentShares.value || allotmentShares.value <= 0) {
    return ElMessage.warning(t('admin.allotment_shares'))
  }
  allotmentLoading.value = true
  try {
    const res = await doAllotment(allotmentStock.value.id, { bonus_per_share: allotmentShares.value })
    const count = res.data?.affected_users || 0
    ElMessage.success(`${t('admin.allotment_success')}，${t('admin.allotment_affected', { n: count })}`)
    showAllotmentDialog.value = false
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  } finally {
    allotmentLoading.value = false
  }
}

/**
 * createInvite
 * Description: Creates a new invite code for the specified group.
 * @returns {Promise<void>}
 */
const createInvite = async () => {
  try {
    await createInviteCode(inviteForm)
    ElMessage.success(t('admin.create_success'))
    showInviteDialog.value = false
    inviteList.value = await getInviteCodes().then(r => r.data?.list || [])
  } catch (err) {
    ElMessage.error(err.message || t('admin.operate_failed'))
  }
}

/**
 * handleLogout
 * Description: Clears admin authentication data and redirects to the admin login page.
 * @returns {void}
 */
const handleLogout = () => {
  localStorage.removeItem('adminToken')
  localStorage.removeItem('adminId')
  router.push('/admin-login')
}
</script>

<style scoped>
.admin-container {
  height: 100vh;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 20px;
  background: white;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
}

.el-container {
  height: calc(100vh - 80px);
}

.el-aside {
  background: white;
  padding: 20px 0;
}

.el-main {
  background: #f5f5f5;
  padding: 20px;
}

.stat-item {
  text-align: center;
  padding: 20px;
}

.stat-label {
  font-size: 14px;
  color: #999;
  margin-bottom: 10px;
}

.stat-value {
  font-size: 32px;
  font-weight: bold;
  color: #333;
}

.stat-value.highlight-blue { color: #409eff; }
.stat-value.highlight-green { color: #67c23a; }
.stat-value.highlight-orange { color: #e6a23c; }

.rank-row {
  display: flex;
  align-items: center;
  padding: 12px 0;
  border-bottom: 1px solid #f0f0f0;
}
.rank-row:last-child { border-bottom: none; }

.rank-badge {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: bold;
  color: #fff;
  margin-right: 12px;
  flex-shrink: 0;
}
.rank-1 { background: linear-gradient(135deg, #f7c948, #e6b800); }
.rank-2 { background: linear-gradient(135deg, #c0c0c0, #a8a8a8); }
.rank-3 { background: linear-gradient(135deg, #cd7f32, #b8860b); }

.rank-name {
  flex: 1;
  font-size: 14px;
  color: #333;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.rank-value {
  font-size: 14px;
  font-weight: bold;
  margin-left: 12px;
  white-space: nowrap;
}

.rank-rate {
  font-size: 12px;
  margin-left: 8px;
  white-space: nowrap;
}

.rank-value.profit, .rank-rate.profit { color: #f56c6c; }
.rank-value.loss, .rank-rate.loss { color: #67c23a; }

.empty-card {
  text-align: center;
  padding: 30px;
  color: #999;
  font-size: 14px;
}

.profit-positive { color: #f56c6c; }
.profit-negative { color: #67c23a; }

.pagination-wrap {
  margin-top: 15px;
  display: flex;
  justify-content: flex-end;
}

.about-section {
  padding: 20px;
}

.about-content {
  padding: 10px 0;
}

.about-content .info-row {
  display: flex;
  padding: 10px 0;
  border-bottom: 1px solid #eee;
}

.about-content .info-row .label {
  width: 100px;
  color: #666;
}

.about-content .info-row .value {
  font-weight: bold;
  color: #333;
}
</style>

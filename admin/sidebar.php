<?php
$currentPage = basename($_SERVER['PHP_SELF']);
function isActive($page, $current)
{
    return ($page === $current) ? 'active' : '';
}
?>
<div class="sidebar shadow">
    <div class="p-4 mb-2 d-flex align-items-center">
        <img src="../img/logo.png" alt="GlebasNord Logo" style="width: 32px; height: 32px;" class="me-3">
        <h5 class="mb-0 fw-bold text-white">GlebasNord</h5>
    </div>

    <div class="px-4 py-3 mb-3 border-top border-bottom border-secondary border-opacity-25 bg-white bg-opacity-5">
        <div class="small text-muted text-uppercase fw-bold mb-1" style="font-size: 0.65rem;">Usuário Ativo</div>
        <div class="fw-bold text-black">
            <?php echo htmlspecialchars($_SESSION['admin_name'] ?? $_SESSION['admin_user']); ?>
        </div>
        <div class="badge bg-<?php echo (($_SESSION['admin_role'] ?? '') === 'superadmin' ? 'warning' : 'info'); ?> mt-1"
            style="font-size: 0.6rem;">
            <?php echo strtoupper($_SESSION['admin_role'] ?? 'analista'); ?>
        </div>
    </div>

    <nav class="nav flex-column">
        <a class="nav-link <?php echo isActive('dashboard.php', $currentPage); ?>" href="dashboard.php"><i
                class="bi bi-grid-1x2-fill"></i>Dashboard</a>
        <a class="nav-link <?php echo isActive('settings.php', $currentPage); ?>" href="settings.php"><i
                class="bi bi-gear-fill"></i>Configurações</a>
        <a class="nav-link <?php echo isActive('layers.php', $currentPage); ?>" href="layers.php"><i
                class="bi bi-layers-fill"></i>Camadas (Custom)</a>
        <a class="nav-link <?php echo isActive('users.php', $currentPage); ?>" href="users.php"><i
                class="bi bi-people-fill"></i>Usuários Admin</a>
        <a class="nav-link <?php echo isActive('cache.php', $currentPage); ?>" href="cache.php"><i
                class="bi bi-hdd-fill text-info"></i>Gestão de Cache</a>
        <a class="nav-link <?php echo isActive('firewall.php', $currentPage); ?>" href="firewall.php"><i
                class="bi bi-shield-slash-fill text-warning"></i>Firewall IPs</a>
        <a class="nav-link <?php echo isActive('health.php', $currentPage); ?>" href="health.php"><i
                class="bi bi-heart-pulse-fill text-danger"></i>Status APIs</a>
        <a class="nav-link <?php echo isActive('proxy.php', $currentPage); ?>" href="proxy.php"><i
                class="bi bi-shield-lock-fill"></i>Proxy Whitelist</a>
        <a class="nav-link <?php echo isActive('reports.php', $currentPage); ?>" href="reports.php"><i
                class="bi bi-bar-chart-fill"></i>Relatórios (BI)</a>

        <div class="mt-auto p-4 w-100">
            <a href="logout.php" class="btn btn-outline-danger w-100 border-0">
                <i class="bi bi-box-arrow-left me-2"></i>Sair
            </a>
        </div>
    </nav>
</div>
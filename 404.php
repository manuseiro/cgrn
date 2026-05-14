<?php
/**
 * @file 404.php
 * @description Página de erro 404 personalizada.
 */
http_response_code(404);
?>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Página Não Encontrada | GlebasNord</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
  <style>
    body {
      background: #FDFEFE;
      height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      font-family: 'Inter', system-ui, sans-serif;
    }

    .error-container {
      text-align: center;
      max-width: 600px;
      padding: 2rem;
    }

    .error-num {
      font-size: 10rem;
      font-weight: 900;
      background: linear-gradient(135deg, #B9770E 0%, #D35400 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      line-height: 1;
      margin-bottom: 0;
      opacity: 0.15;
      position: absolute;
      left: 50%;
      top: 50%;
      transform: translate(-50%, -50%);
      z-index: -1;
      pointer-events: none;
    }

    .content-box {
      position: relative;
      z-index: 1;
    }

    .logo-img {
      width: 100px;
      margin-bottom: 2.5rem;
      filter: drop-shadow(0 5px 15px rgba(0, 0, 0, 0.1));
    }

    .btn-home {
      padding: 0.8rem 2.5rem;
      font-weight: 600;
      border-radius: 50px;
      box-shadow: 0 4px 15px rgba(185, 119, 14, 0.3);
      transition: all 0.3s;
    }

    .btn-home:hover {
      transform: translateY(-3px);
      box-shadow: 0 8px 25px rgba(185, 119, 14, 0.4);
    }
  </style>
</head>

<body>
  <div class="error-num">404</div>

  <div class="error-container">
    <div class="content-box">
      <a href="./">
        <img src="img/logo.png" alt="GlebasNord Logo" class="logo-img">
      </a>
      <h1 class="fw-bold mb-3">Ops! Onde estamos?</h1>
      <p class="text-muted fs-5 mb-5">Parece que você navegou para uma gleba inexistente. A página que você procura não
        foi encontrada ou foi movida.</p>

      <div class="d-flex flex-column flex-sm-row gap-3 justify-content-center">
        <a href="./" class="btn btn-primary btn-home">
          <i class="bi bi-house-door-fill me-2"></i>Voltar ao Início
        </a>
        <a href="mailto:contato@glebasnord.com.br" class="btn btn-outline-secondary rounded-pill px-4">
          <i class="bi bi-envelope-fill me-2"></i>Suporte
        </a>
      </div>
    </div>

    <div class="mt-5 pt-5 opacity-50 small text-muted">
      &copy; <?php echo date('Y'); ?> GlebasNord - Cálculo e Validação de Glebas Nordeste
    </div>
  </div>
</body>

</html>
<!DOCTYPE html>
<html lang="pt-BR">

<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Manutenção | GlebasNord</title>
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/dist/css/bootstrap.min.css">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/bootstrap-icons@1.11.3/font/bootstrap-icons.min.css">
    <style>
        body {
            background: #FDFEFE;
            display: flex;
            align-items: center;
            justify-content: center;
            height: 100vh;
            text-align: center;
            font-family: 'Inter', sans-serif;
        }

        .card {
            border-radius: 20px;
            border: none;
            box-shadow: 0 10px 30px rgba(0, 0, 0, 0.05);
            padding: 3rem;
            max-width: 500px;
        }

        .icon-box {
            font-size: 4rem;
            color: #B9770E;
            margin-bottom: 1.5rem;
        }
    </style>
</head>

<body>
    <div class="card">
        <div class="icon-box"><i class="bi bi-tools"></i></div>
        <h2 class="fw-bold mb-3">Estamos em Manutenção</h2>
        <p class="text-muted mb-4">

            <?php echo htmlspecialchars($settings['MAINTENANCE_MSG'] ?? 'O sistema está sendo atualizado para melhor atendê-lo. Voltamos em breve!'); ?>
        </p>
        <div class="d-grid">
            <a href="mailto:contato@glebasnord.com.br" class="btn btn-warning rounded-pill fw-bold text-white shadow-sm"
                style="background: #B9770E; border: none; padding: 12px;">Falar com o Suporte</a>
        </div>
        <p class="mt-4 small text-muted">Agradecemos a sua paciência.</p>
    </div>
</body>

</html>
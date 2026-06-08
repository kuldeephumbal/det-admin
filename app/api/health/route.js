const { NextResponse } = require('next/server');

exports.GET = async () =>
  NextResponse.json({
    status: 'ok',
    uptime: process.uptime(),
    timestamp: new Date().toISOString(),
  });
